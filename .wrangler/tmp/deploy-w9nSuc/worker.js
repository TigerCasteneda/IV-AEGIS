// worker.js
var worker_default = {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        service: "iv-aegis-worker"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/contact/submit" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, email, message } = body;
        if (!name || !email || !message) {
          return new Response(JSON.stringify({
            success: false,
            message: "Please provide all required fields: name, email, message"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return new Response(JSON.stringify({
            success: false,
            message: "Please provide a valid email address"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
        const userAgent = request.headers.get("User-Agent") || "unknown";
        if (env.DB) {
          await env.DB.prepare(
            "INSERT INTO contacts (name, email, message, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
          ).bind(name, email, message, clientIP, userAgent).run();
        }
        return new Response(JSON.stringify({
          success: true,
          message: "Thank you for your message! We will get back to you soon."
        }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          message: "Failed to save contact information",
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/api/contact/list" && request.method === "GET") {
      try {
        if (env.DB) {
          const { results } = await env.DB.prepare(
            "SELECT id, name, email, message, created_at, status FROM contacts ORDER BY created_at DESC LIMIT 100"
          ).all();
          return new Response(JSON.stringify({
            success: true,
            data: results,
            count: results.length
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          message: "Failed to fetch contacts"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    return new Response(JSON.stringify({
      success: false,
      message: `Route ${url.pathname} not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
