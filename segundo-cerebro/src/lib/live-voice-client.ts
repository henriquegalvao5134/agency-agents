// Vanilla WebRTC/WebSocket voice-connection state machine for Jarvis.
// Extracted from src/hooks/use-live-voice.ts: this module has no React
// dependency -- it is the actual connection logic (microphone capture,
// peer connection, data channel, heartbeat, teardown). The hook in
// use-live-voice.ts is a thin adapter that feeds this factory's events
// into React state.
export type LiveEvent = {
  type: string;
  reason?: string;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  transport?: { type?: string; sdp?: string };
  [key: string]: unknown;
};

type LiveOptions = {
  url: string;
  audio: HTMLAudioElement;
  onEvent: (event: LiveEvent) => void;
};

export function createLiveVoice(options: LiveOptions) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let socket: WebSocket | undefined;
  let peer: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let microphone: MediaStream | undefined;
  let playback: MediaStream | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelGathering: (() => void) | undefined;
  let lastAck = 0;
  let lastHeartbeat = 0;
  let answerReceived = false;
  let finalized = false;
  let muted = false;

  function starting() {
    return state === "starting";
  }

  function send(event: object) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }

  function stopAudio() {
    microphone?.getTracks().forEach((track) => track.stop());
    if (playback && options.audio.srcObject === playback) {
      options.audio.pause();
      options.audio.srcObject = null;
    }
  }

  function release() {
    if (state === "closed") return;
    state = "closed";
    clearInterval(heartbeat);
    clearTimeout(deadline);
    cancelGathering?.();
    window.removeEventListener("pagehide", stop);
    stopAudio();
    channel?.close();
    peer?.close();
    socket?.close();
    options.onEvent({ type: "app.closed", finalized });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    try {
      send({ type: "session.close" });
    } catch {
      return release();
    }
    stopAudio();
    cancelGathering?.();
    clearInterval(heartbeat);
    clearTimeout(deadline);
    deadline = setTimeout(release, 15_000);
    options.onEvent({ type: "app.stopping" });
    if (!socket || socket.readyState !== WebSocket.OPEN) release();
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return true;
  }

  async function resumePlayback() {
    if ((state !== "starting" && state !== "active") || !options.audio.srcObject) return;
    try {
      await options.audio.play();
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.resumed" });
    } catch {
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.blocked" });
    }
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    options.onEvent({ type: "app.error", error: { message } });
    stop();
  }

  function reportUnexpectedClosure(reason?: string) {
    if (state === "stopping" || state === "closed") return;
    const messages: Record<string, string> = {
      startup_timeout: "A conversa demorou para iniciar. Tente uma nova chamada.",
      initial_heartbeat_timeout: "O áudio não conectou. Tente uma nova chamada.",
      heartbeat_timeout: "A conexão foi perdida. Inicie uma nova chamada.",
      gateway_shutdown: "O serviço de voz reiniciou. Inicie uma nova chamada.",
      inactivity_timeout: "A conversa terminou por inatividade.",
      duration_limit: "A conversa atingiu o limite de duração. Inicie outra chamada.",
    };
    options.onEvent({
      type: "app.error",
      error: { message: messages[reason ?? ""] ?? "A conversa terminou inesperadamente. Inicie uma nova chamada." },
    });
  }

  function mediaReady() {
    return peer?.connectionState === "connected" && channel?.readyState === "open";
  }

  function pulse() {
    if (state !== "active") return;
    if (Date.now() - lastAck >= 5000) return fail("A conexão com Jarvis foi perdida.");
    if (Date.now() - lastHeartbeat >= 5000) return fail("A conexão de áudio foi perdida.");
    if (!mediaReady()) return;
    try {
      send({ type: "gateway.heartbeat" });
      lastHeartbeat = Date.now();
    } catch {
      fail("Voice control connection failed");
    }
  }

  function activate() {
    if (!answerReceived || !mediaReady()) return;
    if (starting()) {
      state = "active";
      clearTimeout(deadline);
      lastAck = Date.now();
      lastHeartbeat = Date.now();
      heartbeat = setInterval(pulse, 1000);
      pulse();
      if (state !== "active") return;
      send({ type: "app.ready" });
      options.onEvent({ type: "app.connected" });
    } else pulse();
  }

  async function applyAnswer(event: LiveEvent) {
    if (!starting() || !peer) return;
    if (answerReceived || event.transport?.type !== "webrtc" || !event.transport.sdp) {
      throw new Error("Invalid voice session answer");
    }
    answerReceived = true;
    clearTimeout(deadline);
    deadline = setTimeout(
      () => fail("O áudio não conectou. Inicie uma nova chamada."),
      12_000,
    );
    await peer.setRemoteDescription({ type: "answer", sdp: event.transport.sdp });
    activate();
  }

  async function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("A conexão de áudio demorou demais. Verifique sua rede e tente uma nova chamada.")), 10_000);
      function finish(error?: Error) {
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        cancelGathering = undefined;
        if (error) reject(error);
        else resolve();
      }
      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }
      cancelGathering = () => finish(new Error("Call ended"));
      connection.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";
    window.addEventListener("pagehide", stop);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      microphone = stream;
      if (!starting()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const connection = new RTCPeerConnection();
      peer = connection;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
        track.addEventListener("ended", stop);
        connection.addTrack(track, stream);
      }
      connection.addEventListener("track", ({ track }) => {
        if (state === "stopping" || state === "closed") return;
        playback = new MediaStream([track]);
        options.audio.srcObject = playback;
        void resumePlayback();
      });
      connection.addEventListener("connectionstatechange", () => {
        if (connection.connectionState === "failed") fail("Voice media connection failed. Start a new call to retry.");
        else if (connection.connectionState === "closed") fail("Voice media connection closed");
        else activate();
      });
      channel = connection.createDataChannel("oai-events");
      channel.addEventListener("open", activate);
      channel.addEventListener("message", ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "session.started") {
            activate();
          }
        } catch {
          fail("Invalid voice session event");
        }
      });
      channel.addEventListener("error", () => fail("Voice media connection failed"));
      channel.addEventListener("close", stop);
      await connection.setLocalDescription(await connection.createOffer());
      if (!starting()) return;
      await gatherCandidates(connection);
      if (!starting()) return;
      const sdp = connection.localDescription?.sdp;
      if (!sdp) throw new Error("Missing voice session offer");
      socket = new WebSocket(options.url);
      deadline = setTimeout(() => fail("A conversa não iniciou."), 50_000);
      socket.onopen = () => {
        if (!starting()) return release();
        send({ type: "app.start", sdp });
      };
      socket.onmessage = ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "gateway.session.created") {
            void applyAnswer(event).catch(() => fail("Não foi possível conectar o áudio."));
          } else if (event.type === "session.started") {
            activate();
          } else if (event.type === "gateway.heartbeat.ack") {
            lastAck = Date.now();
          } else if (event.type === "session.closed") {
            finalized =
              typeof event.usage?.seconds === "number" &&
              Number.isFinite(event.usage.seconds) &&
              event.usage.seconds >= 0;
            reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return release();
          } else if (
            event.type === "gateway.session.closing" ||
            event.type === "gateway.error" ||
            event.type === "app.error"
          ) {
            if (event.type === "gateway.session.closing") reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return stop();
          }
          options.onEvent(event);
        } catch {
          fail("Invalid voice event");
        }
      };
      socket.onerror = () => fail("Não foi possível conectar ao Jarvis.");
      socket.onclose = () => {
        if (state !== "stopping" && state !== "closed") {
          options.onEvent({ type: "app.error", error: { message: "A conexão com Jarvis foi encerrada." } });
        }
        release();
      };
    } catch (error) {
      fail(error instanceof Error ? error.message : "Não foi possível ativar o microfone.");
    }
  }

  return { start, stop, setMuted, resumePlayback };
}
