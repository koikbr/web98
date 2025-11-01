/**
 * Proxy endpoint for fetching GIF URLs from gifcities.org
 * This allows client-side code to fetch GIFs without CORS issues
 */

export async function GET({ request }: any) {
  try {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("q");

    if (!searchTerm) {
      return new Response(JSON.stringify({ error: "Missing search term" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Fetch from gifcities.org
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    const randomOffset = Math.floor(Math.random() * 21);
    const searchUrl = `https://gifcities.org/search?q=${encodedSearchTerm}&offset=${randomOffset}&page_size=1`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch from gifcities.org" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        },
      );
    }

    const html = await response.text();

    // Parse the HTML to extract the GIF URL
    const imgRegex = /<img[^>]*src=["'](https:\/\/blob\.gifcities\.org\/gifcities\/[^"']+\.(?:gif|GIF))["'][^>]*>/i;
    const match = html.match(imgRegex);

    if (match && match[1]) {
      return new Response(
        JSON.stringify({ url: match[1] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        },
      );
    }

    return new Response(
      JSON.stringify({ error: "No GIF found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      },
    );
  }
}
