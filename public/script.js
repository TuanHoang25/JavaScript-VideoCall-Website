const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

const nameModal = document.getElementById("name-modal");
const nameInput = document.getElementById("name-input");
const setNameButton = document.getElementById("set-name-button");

const micButton = document.getElementById("toggle-mic");
const cameraButton = document.getElementById("toggle-camera");

let myName;
let myStream;
const peers = {};
// chay local thì chạy 3 dong dưới đây
const myPeer = new Peer(undefined, {
  host: "/",
  port: "3001",
});
//chạy trên mạng
// const myPeer = new Peer(undefined, {
//   host: "amazdo.com",
//   path: "/peerjs",
// });
const myVideo = document.createElement("video");
myVideo.muted = true;

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myStream = stream; // Gán stream vào biến myStream
    addVideoStream(myVideo, stream);

    myPeer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    // Khi người dùng kết nối
    socket.on("user-connected", (userId, userName) => {
      connectToNewUser(userId, stream);
      appendMessage(`(${userName}) đã kết nối phòng họp`);
    });

    // Khi người dùng ngắt kết nối
    socket.on("user-disconnected", (userId, userName) => {
      if (peers[userId]) peers[userId].close();
      appendMessage(`(${userName}) ngắt kết nối phòng họp`);
    });
  });

// Cập nhật các sự kiện khi micro hoặc camera được bật/tắt
micButton.addEventListener("click", () => {
  const audioTracks = myStream.getAudioTracks();
  if (audioTracks.length > 0) {
    const enabled = audioTracks[0].enabled;
    audioTracks[0].enabled = !enabled;
    micButton.querySelector("span").textContent = enabled ? "mic_off" : "mic";

    // Gửi trạng thái micro đến server
    socket.emit("toggle-mic", !enabled);
  }
});

cameraButton.addEventListener("click", () => {
  const videoTracks = myStream.getVideoTracks();
  if (videoTracks.length > 0) {
    const enabled = videoTracks[0].enabled;
    videoTracks[0].enabled = !enabled;
    cameraButton.querySelector("span").textContent = enabled
      ? "videocam_off"
      : "videocam";

    // Gửi trạng thái camera đến server
    socket.emit("toggle-camera", !enabled);
  }
});

myPeer.on("open", (id) => {
  nameModal.style.display = "flex";
  setNameButton.addEventListener(
    "click",
    () => {
      myName = nameInput.value.trim();
      if (myName) {
        socket.emit("join-room", ROOM_ID, id, myName); // Gửi tên người dùng khi tham gia phòng
        appendMessage(`Bạn đã tham gia phòng họp với tên là:  ${myName}`);
        nameModal.style.display = "none";
      }
    },
    { once: true }
  ); // Sử dụng { once: true } để sự kiện chỉ được thực hiện một lần
});

sendButton.addEventListener("click", () => {
  const message = messageInput.value.trim();
  if (message) {
    appendMessage(`You: ${message}`);
    socket.emit("send-chat-message", `${myName}: ${message}`);
    messageInput.value = "";
  }
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendButton.click();
  }
});
socket.on("chat-message", (message) => {
  appendMessage(message);
});

let activityTimer;
socket.on("message-input-container", (name) => {
  activity.textContent = `${name} is typing...`;

  // Xóa thông báo sau 3 giây
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => {
    activity.textContent = "";
  }, 3000);
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

function appendMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.innerText = message;
  chatBox.append(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}
