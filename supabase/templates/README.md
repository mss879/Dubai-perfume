# Auth email templates

Branded replacements for Supabase's default auth emails, which were unstyled
black-on-white HTML and looked nothing like the maison.

These are **not** applied by any migration — Supabase auth emails live in the
project dashboard, not in the database. Paste them in by hand.

## Installing

Dashboard → **Authentication → Emails → Templates**, then for each template
below switch the Body editor to **Source**, replace everything, and Save.

| Template in the dashboard | File | Suggested subject |
| --- | --- | --- |
| Confirm signup | [`confirm-signup.html`](confirm-signup.html) | Confirm your email address |
| Reset password | [`reset-password.html`](reset-password.html) | Reset your password |

Magic Link, Invite user, Change email and Reauthentication are not used by the
storefront today. If any is switched on later, copy either file and change the
eyebrow, heading, body sentence and button label — everything else is the shell.

## What the design is made of

Nothing here is invented; it is sampled from the real brand.

- **Gold `#AE8626`** — the dominant gold in `public/logo.png` itself, used only
  as the short rule under the wordmark and for the fallback link.
- **Ink `#121212`, muted `#646464`, hairline `#E0E0E0`, surface `#F5F5F5`** —
  the maison tokens from `src/app/globals.css` (the hairline is `--line`,
  `rgba(0,0,0,0.12)`, flattened onto white because email cannot do alpha
  borders reliably).
- **Georgia** for the heading — the email-safe stand-in for Source Serif 4,
  which the storefront uses via `next/font` and cannot be loaded in an inbox.
- **Button** — `#121212`, square, 12px, 500 weight, `0.2em` tracking, matching
  `.maison-btn`.

## Notes for whoever edits these next

- **Tables and inline styles only.** No flexbox, no grid, no external CSS —
  Outlook drops all three.
- **The logo is referenced absolutely** (`https://gharibperfumes.com/logo.png`).
  It must stay publicly reachable or every email arrives with a broken image.
  Do not swap it for a local path or a `data:` URI — Gmail blocks the latter.
- **The `<img>` alt text is styled on purpose.** Blocked remote images are the
  default in a lot of clients, so the alt text is what many people actually see.
  Styling it black, in Georgia, with no underline makes that fallback read as
  the wordmark instead of a blue Times hyperlink. Keep those inline styles if
  you edit the logo block.
- **Dark mode is opted out of** via the `color-scheme` meta tags. The wordmark
  is black on transparency, so a client that force-inverts would erase it.
- **`{{ .ConfirmationURL }}` appears twice on purpose** — once on the button and
  once as a copyable link, because some clients and corporate filters strip
  buttons.

## The dashboard preview shows a broken logo. That is expected.

The Supabase dashboard serves a Content-Security-Policy whose `img-src`
allowlist covers `supabase.com`, `*.supabase.co`, GitHub and a few others — but
not `gharibperfumes.com`. So the preview pane's browser refuses to paint our
logo no matter what the template says. That is what the dashboard's own "Email
rendering may differ" notice is about.

It does not affect delivered mail: Gmail fetches images through its own proxy
server-side, and Apple Mail and Outlook fetch them directly. None of them are
bound by supabase.com's CSP. Verified separately that the file returns HTTP 200
and carries no `Cross-Origin-Resource-Policy`, so nothing on our side blocks
embedding either — Netlify serves `public/` straight from the edge, so the
`next.config.ts` security headers never apply to it.

If a correct dashboard preview matters to you, upload the logo to Supabase
Storage and point the template at that `*.supabase.co` URL, which is on the
allowlist. Judge the real thing by sending yourself a test email instead.

## One dependency worth knowing

The confirm email says the shopper "will be signed in straight away". That is
only true while `https://gharibperfumes.com/auth/callback` is listed under
**Authentication → URL Configuration → Redirect URLs**. Without it Supabase
substitutes the Site URL, the link lands on the homepage, the code is never
exchanged, and the shopper has to sign in by hand — making that sentence untrue.
Change the copy or add the allowlist entry; do not leave it half done.
