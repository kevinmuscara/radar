import { serve } from "bun";

serve({
  port: 80,
  routes: {
    "/": () => new Response("Hello World!"),
    // Initial setup upload brand logo
    "/setup/brand": {
      POST: async (request) => {
        const formData = await request.formData();
        const file = formData.get("file");

        if (file) {
          await Bun.write("src/public/logo.png", file);
        }

        return Response.json({ status: 200 });
      }
    }
  }
});

console.log(`server live`);