module.exports = async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  if (req.method === "GET") {
    res.status(200).json({ hasData: false, payload: null });
    return;
  }

  if (req.method === "PUT") {
    res.status(200).json({
      ok: true,
      persisted: false,
      note: "Vercel preview stores workspace changes in browser localStorage only.",
    });
    return;
  }

  res.setHeader("allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
};
