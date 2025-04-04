
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
const endCallButton = document.getElementById("end-call-button");
const screenShareButton = document.getElementById("screen-share-button");
let isScreenSharing = false;
let screenStream;

let myName;
let myStream;
const peers = {};
// chay local thì chạy 3 dong dưới đây
// const myPeer = new Peer(undefined, {
//   host: "/",
//   port: "3001",
// });

// Sử dụng trên Render
const myPeer = new Peer(undefined, {
  cloud: true, // Thay bằng hostname của Render app
  debug:3
});





// Nhận sự kiện từ server để ngắt kết nối
socket.on("call-ended", () => {
  myStream.getTracks().forEach(track => track.stop()); // Dừng tất cả các stream
  Object.values(peers).forEach(peer => peer.close()); // Đóng tất cả các kết nối
  window.location.href = "/"; // Chuyển về trang chủ
});

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

// Sự kiện khi click vào nút "call end"
endCallButton.addEventListener("click", () => {
  socket.emit("end-call", ROOM_ID); // Gửi yêu cầu kết thúc cuộc gọi đến server
});

// Xử lý chia sẻ màn hình
screenShareButton.addEventListener("click", async () => {
  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Gửi stream màn hình cho tất cả các peer đang kết nối
      for (let peerId in peers) {
        const sender = peers[peerId].peerConnection
          .getSenders()
          .find((s) => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      }

      // Cập nhật stream local của chính mình
      const videoTrack = myStream.getVideoTracks()[0];
      myStream.removeTrack(videoTrack);
      myStream.addTrack(screenTrack);

      screenTrack.onended = () => {
        stopScreenShare();
      };

      isScreenSharing = true;
      screenShareButton.querySelector("span").textContent = "stop_screen_share";
    } catch (err) {
      console.error("Không thể chia sẻ màn hình:", err);
    }
  } else {
    stopScreenShare();
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

function stopScreenShare() {
  const videoTrack = myStream.getVideoTracks()[0];
  screenStream.getTracks().forEach((track) => track.stop());

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((camStream) => {
      const camTrack = camStream.getVideoTracks()[0];

      for (let peerId in peers) {
        const sender = peers[peerId].peerConnection
          .getSenders()
          .find((s) => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(camTrack);
        }
      }

      myStream.removeTrack(videoTrack);
      myStream.addTrack(camTrack);

      const myVideoTrack = myVideo.srcObject.getVideoTracks()[0];
      myVideo.srcObject.removeTrack(myVideoTrack);
      myVideo.srcObject.addTrack(camTrack);

      isScreenSharing = false;
      screenShareButton.querySelector("span").textContent = "screen_share";
    });
}