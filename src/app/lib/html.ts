/**
 * Safety helpers for markup that reaches the browser as raw HTML.
 *
 * Two jobs, both dependency-free and server-safe:
 *  - sanitizeHtml() for admin-authored journal bodies, which the rich-text
 *    editor stores as whatever innerHTML the author pasted.
 *  - jsonLdScript() for structured data, which JSON.stringify alone cannot
 *    make safe to sit inside a <script> tag.
 */

/* Tags a journal entry may contain. Anything else is unwrapped — the tag goes,
   its text stays — so stray markup never eats a paragraph of the owner's copy. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "img",
  "figure",
  "figcaption",
  "hr",
  "span",
]);

/* Attributes kept, per tag; every tag not listed here keeps none. This is what
   removes all on* handlers, and also the style/class attributes a paste from
   another site drags in — those are dropped deliberately, the article body is
   styled by .maison-prose. */
const ALLOWED_ATTRIBUTES: Record<string, readonly string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
};

/* Elements carrying code or foreign markup rather than prose. These go with
   their contents — unwrapping a <script> would leave its source sitting in the
   article as visible text. */
const STRIPPED_ELEMENTS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
];

const VOID_TAGS = new Set(["br", "hr", "img"]);

/* Quoted attribute values may contain ">", hence the alternation rather than a
   plain [^>]* run. */
const TAG_TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

const escapeText = (value: string) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* "&" is left alone on purpose: the input is already HTML, so re-encoding it
   would turn an authored &amp; into &amp;amp;. */
const escapeAttribute = (value: string) =>
  value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A URL that is safe to put in href/src, or null to drop the attribute.
 *
 * The scheme is read from a decoded, whitespace-stripped copy because
 * "java&#115;cript:" and "java\tscript:" both still execute in a browser; the
 * original string is what gets emitted once the scheme passes.
 */
function safeUrl(value: string, allowInlineImage: boolean): string | null {
  const scheme = value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/[\u0000-\u0020]/g, "")
    .toLowerCase();

  // data: is allowed for images only, and only for real raster payloads —
  // data:image/svg+xml carries scripts, so it is not on the list.
  if (allowInlineImage && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/.test(scheme)) {
    return value;
  }
  if (/^(https?:|mailto:|tel:)/.test(scheme)) return value;
  if (scheme.startsWith("/") || scheme.startsWith("#") || scheme.startsWith("?")) return value;
  // Any other scheme (javascript:, data:, vbscript:, file:) is refused; what is
  // left has no colon before the first slash, i.e. a relative path.
  return /^[a-z0-9+.-]*:/.test(scheme) ? null : value;
}

function buildAttributes(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRIBUTES[tag];
  if (!allowed || raw.trim() === "") return "";

  const kept: string[] = [];
  let match: RegExpExecArray | null;
  ATTRIBUTE.lastIndex = 0;
  while ((match = ATTRIBUTE.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;

    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name === "href" || name === "src") {
      const url = safeUrl(value, tag === "img");
      if (url === null) continue;
      kept.push(`${name}="${escapeAttribute(url)}"`);
      continue;
    }
    kept.push(`${name}="${escapeAttribute(value)}"`);
  }

  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

/**
 * Reduce untrusted HTML to the allowlist above.
 *
 * This is a tokeniser, not an HTML parser: it walks the string tag by tag and
 * rebuilds it, escaping everything between tags. That is enough for the
 * editor's own output and for content pasted out of another site, and it is
 * what keeps this file dependency-free. Its known limits:
 *  - it does not implement the HTML5 tree builder, so deeply malformed markup
 *    is rewritten conservatively rather than reproduced exactly;
 *  - it assumes the result is inserted as element content (which is how the
 *    journal renders it), never into an attribute or a script;
 *  - mutation-XSS through foreign content is answered bluntly, by dropping
 *    <svg> and <math> entirely rather than trying to sanitise them.
 * Treat it as the last line of defence, not a licence to trust the editor.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";

  // The "|$" arms matter: an unterminated <script> must still be swallowed.
  let html = input.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  STRIPPED_ELEMENTS.forEach((tag) => {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}\\s*>|$)`, "gi"), "");
  });
  html = html.replace(/<[!?][^>]*>/g, "");

  const out: string[] = [];
  const open: string[] = [];
  let cursor = 0;
  let token: RegExpExecArray | null;

  TAG_TOKEN.lastIndex = 0;
  while ((token = TAG_TOKEN.exec(html)) !== null) {
    out.push(escapeText(html.slice(cursor, token.index)));
    cursor = TAG_TOKEN.lastIndex;

    const tag = token[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (token[0].startsWith("</")) {
      const depth = open.lastIndexOf(tag);
      if (depth === -1) continue; // closer with no opener
      while (open.length > depth) out.push(`</${open.pop()}>`);
      continue;
    }

    out.push(`<${tag}${buildAttributes(tag, token[2])}>`);
    if (!VOID_TAGS.has(tag)) open.push(tag);
  }

  out.push(escapeText(html.slice(cursor)));
  // Close what the author left open, so an unterminated <a> cannot wrap the
  // rest of the page in a link.
  while (open.length > 0) out.push(`</${open.pop()}>`);

  return out.join("");
}

/**
 * Serialise structured data for a <script type="application/ld+json"> body.
 *
 * JSON.stringify leaves "<" untouched, so a product name or article title
 * containing "</script>" closes the tag and everything after it is parsed as
 * markup. Escaping the three markup characters plus the two line separators
 * (legal in JSON strings, illegal in a JavaScript source line) keeps the
 * payload valid JSON while making it inert inside HTML.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
