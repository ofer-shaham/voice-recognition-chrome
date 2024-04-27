export const setMute = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
            stream.getAudioTracks().forEach(function (track) {
                track.enabled = false;
            });

        })
}
export const setUnmute = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
            stream.getAudioTracks().forEach(function (track) {
                track.enabled = true;
            });

        })
}