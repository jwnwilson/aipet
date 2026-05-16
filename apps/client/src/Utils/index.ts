const isLocal = function () {
    return window.location.host === "localhost:8080";
};

const apiUrl = function (port) {
    if (isLocal()) {
        return "http://localhost:" + port;
    }
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    return serverUrl ?? "https://" + window.location.hostname;
};

export { isLocal, apiUrl };
