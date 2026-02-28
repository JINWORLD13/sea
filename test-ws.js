import WebSocket from "ws";

console.log("Connecting to ws://localhost:8080...");
const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log(
    "Connected to proxy server. Sending subscription for Busan port area...",
  );
  const subscriptionMsg = {
    BoundingBoxes: [
      [
        [-90, -180],
        [90, 180],
      ],
    ],
  };
  ws.send(JSON.stringify(subscriptionMsg));
});

ws.on("message", (data) => {
  try {
    const rawData = JSON.parse(data.toString());
    if (rawData.error) {
      console.error("Received error from proxy:", rawData);
      process.exit(1);
    }
    if (rawData.MessageType === "PositionReport") {
      console.log("✅ Received PositionReport API data!");
      console.log(
        "Sample Data:",
        JSON.stringify(rawData).substring(0, 300) + "...",
      );

      console.log("\nSuccess! Real API data is flowing correctly.");
      ws.close();
      process.exit(0);
    } else {
      console.log("Received MessageType:", rawData.MessageType);
    }
  } catch (e) {
    console.error("Failed to parse message", e);
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err);
  process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error("Timeout: Did not receive position reports within 15 seconds.");
  process.exit(1);
}, 15000);
