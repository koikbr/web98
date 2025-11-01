/**
 * Prompt generation logic parallel to the Swift `genPrompt` and `genSearchSuggestionsPrompt`.
 * These helpers produce ChatCompletion message arrays compatible with the OpenRouter client.
 */

export const baseWorld = `
  Pretend it is an alternate-reality version of *1996* where:
  - The web is the "information superhighway" and every site reflects its creator's unique vision
  - Sites range from corporate portals to personal shrines to experimental chaos
  - Each website type has its own aesthetic language - study the URL and context to determine what fits
  - webmasters use whatever HTML they know, resulting in wildly different approaches
  - Some sites are geocities-style personal pages, others are serious business, others are pure experimentation
  - No site should look like a template - they're all hand-coded with varying levels of skill and taste
  - You can use the basic, most used emojis; they will be replaced by emoticons from the time
`.trim();

/**
 * If a provided world description is empty/whitespace, fallback to the default.
 */
export function normalizeWorld(world) {
  const s = (world ?? "").trim();
  return s.length ? s : baseWorld;
}

/**
 * Generates the chat messages for producing an HTML page for a given URL,
 * following the same structure and instructions as the Swift `genPrompt(url:world:)`.
 *
 * @param urlOrString The URL to "navigate" to (string or URL instance)
 * @param world The "world description" to guide the LLM's tone and content
 */
export function genPrompt(urlOrString, world) {
  const urlStr =
    typeof urlOrString === "string" ? urlOrString : urlOrString.toString();
  const isPost = isPostUrl(urlStr);

  const messages = [];

  messages.push({
    role: "system",
    content: [
      "You are a clever comedian and rich world-builder, acting as an imaginary web server from in an alternate reality.",
      'First, you will be provided with a "world description" describing the imaginary world that the server should pretend to inhabit.',
      "Then, when prompted with a URL, you are to output a valid HTML page that could plausibly represent the requested URL. Output the HTML and only the HTML.",
      "",
      "HTML PAGES SHOULD:",
      "- Use simple, concise HTML appropriate to the site type and purpose",
      "- Vary drastically in structure and density based on context:",
      "  - Personal homepages: chaotic, excessive, personality-driven (visitor counters, under construction)",
      "  - Corporate sites: more structured, professional tone but still colorful",
      "  - Fan sites: dense with content, obsessive detail, fan shrine aesthetics",
      "  - Forums/communities: discussion-focused layouts, thread structures",
      "  - E-commerce: product grids, shopping cart links",
      "  - News/portals: multi-column layouts, lots of headlines",
      "  - Some sites are minimalist, others are visual chaos - match the era and purpose",
      "- Choose elements that fit the site type. Available: links, tables, headers, hrs, divs, forms, marquee, blink, center, blockquote, ul/ol, pre, frames references",
      '- Use <img> tags with descriptive alt attributes for GIFs (*leave src= blank*, don\'t add src at all). The alt text should be a search term for gifcities.org. For example: <img alt="under construction"> or <img alt="spinning logo">',
      "  - example: <img alt=\"funny cat meme\">",
      "- When including GIFs, choose search terms that match the content and context of the page. For example, use 'under construction' for construction GIFs, 'email' for email-related GIFs, etc.",
      "- Use images sparingly or excessively based on what fits the site",
      "- Forms should have descriptive `action` parameters ending in `.php` when relevant",
      "- Length varies: some sites are single-screen, others scroll for days",
      "- Specify fonts/colors using inline <font> tags and element attributes. NO <style> tags in <head>.",
      "  - Go wild with color combinations - some sites had taste, others absolutely did not",
      '  - Backgrounds: solid colors, or refer to patterns like "background=pattern.gif" (don\'t include actual file)',
      "- Links should use the site's actual domain name in a meaningful way, not generic paths",
      "- Let personality and purpose drive every design choice",
      "",
      "The web in this era was beautifully diverse - no templates, no design systems, pure expression.",
      "Every webmaster had different skills, tastes, and priorities. Some cared about aesthetics, others just wanted information out there.",
      "First, here is a description of the alternate universe that the server should pretend it exists within. This world description should dictate inform the content, tone and visual aesthetic of the output HTML.",
      "World description:",
    ].join("\n"),
  });

  messages.push({
    role: "user",
    content: world,
  });

  if (isPost) {
    messages.push({
      role: "system",
      content:
        "OK, now a URL will be provided. This URL is a POST request, meaning that the user triggered this request by submitting a form. Form inputs are provided as query parameters. This output page should reflect the server's (imagined) response to the user's form submission. The responses should provide feedback to the user immediately, rather than simply acknowledging submission. (For example, an imaginary college application form would immediately provide a decision.) Output the resulting HTML (and ONLY html, no commentary) for it.",
    });
  } else {
    messages.push({
      role: "system",
      content:
        "OK, now a URL will be provided. Output the resulting HTML only (no commentary). Do not break character.",
    });
  }

  messages.push({
    role: "user",
    content: urlStr,
  });

  return messages;
}

/**
 * Generates the chat messages for producing "search suggestions" inside a given world,
 * mirroring Swift `genSearchSuggestionsPrompt(world:)`.
 *
 * The assistant should output eight suggested links as a single JSON array, inside a code block.
 */
export function genSearchSuggestionsPrompt(world) {
  const messages = [];

  messages.push({
    role: "system",
    content: [
      "You are a clever comedian and rich world-builder, acting as an imaginary web server from in an alternate reality.",
      'First, you will be provided with a "world description" describing the imaginary world that the server should pretend to inhabit.',
      "",
      "First, here is a description of the alternate universe that the server should pretend it exists within.",
      "World description:",
    ].join("\n"),
  });

  messages.push({
    role: "user",
    content: world,
  });

  messages.push({
    role: "system",
    content: [
      'Now, please invent and output eight "suggested links" that might exist, and be interesting, WITHIN the described world. Output them as a single JSON array, within a code block, with each on its own line. For example:',
      "```",
      "[",
      '"https://nytimes.com",',
      '"https://en.wikipedia.org",',
      '"https://youtube.com",',
      '"https://twitter.com/new"',
      "]",
      "```",
      "",
      "Your suggested websites should highlight a diverse set of sites that are uniquely interesting in the world that was described. For example, if the world description indicated that we were in Ancient Rome, we might suggest websites relating to the Roman Senate, a Roman restaurant, a Roman 'forum' and a Yahoo Answers-style website for Romans. The suggestions should be generated while pretending you're inside the universe, and should not \"break character.\" For example if the world was \"The Harry Potter universe,\" suggestions would be for websites relevant to the world itself (e.g. 'ministryofmagic.gov.uk), NOT websites from the real world.)",
      "",
      "Suggested websites from within this world:",
    ].join("\n"),
  });

  return messages;
}

/**
 * Determines whether the URL indicates a POST submission based on the presence of `method=POST`
 * in the query string, aligning with the Swift logic that appends this query param after form submission.
 */
function isPostUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return (u.searchParams.get("method") || "").toUpperCase() === "POST";
  } catch {
    // Attempt to coerce into a URL by adding a scheme, if missing.
    try {
      const u2 = new URL(`https://${urlStr}`);
      return (u2.searchParams.get("method") || "").toUpperCase() === "POST";
    } catch {
      return false;
    }
  }
}