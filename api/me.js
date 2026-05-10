module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    user: { name: "Demo User" },
    auth: { signedIn: false, configured: false },
    mode: "demo",
    note: "Vercel preview is running in demo mode. Portfolio edits save in this browser.",
  });
};
