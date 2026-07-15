---
name: Bulk sed theme conversions
description: Risk of blanket find/replace clobbering just-written files during a dark-to-light (or similar) theme conversion across many pages.
---

When converting a site-wide theme (e.g. dark navy → light/white) across dozens of HTML/CSS files that reuse the same hardcoded color patterns (like `rgba(255,255,255,0.0x)` used as a "lighten" overlay on a dark background), a global sed/regex replace across the whole project is the efficient way to handle the long tail of one-off inline `<style>` blocks.

**Why:** The replace target color (e.g. `rgba(255,255,255,...)`) is often *also* used inside CSS files you already hand-edited earlier in the same session (e.g. a rewritten `background.css` with intentional white-glass card rules). A blanket sed over "all files matching pattern X" will match those too and silently revert the manual fix, since the string pattern looks identical to the legacy dark-theme usage.

**How to apply:** Before running a bulk find/replace, explicitly exclude any file you already wrote/edited by hand in this session (grep for the target pattern in exactly that file first to confirm it's a leftover, not your own new code). After the bulk replace, re-grep the excluded/edited files to make sure the pattern didn't reappear, and re-screenshot to confirm you didn't reintroduce the very thing you just fixed.
