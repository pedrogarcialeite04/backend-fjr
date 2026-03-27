function buildCspDirectives() {
  const connectSrc = ["'self'"];

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(origin => connectSrc.push(origin));
  }

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc,
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    upgradeInsecureRequests: []
  };
}

module.exports = { buildCspDirectives };
