# Darapet Technology — Freelance Agency Website

A premium, fully-featured freelancing agency website built with pure HTML, CSS, and JavaScript. No frameworks, no build tools — just open the files in a browser or push to GitHub and deploy on Netlify/Vercel/GitHub Pages in minutes.

---

## 📁 Folder Structure

```
darapet-site/
├── index.html                    ← Home page
├── css/
│   ├── main.css                  ← All styles
│   └── animations.css            ← Scroll reveals, transitions
├── js/
│   ├── main.js                   ← All interactivity (nav, sliders, counters, forms, FAQ)
│   ├── particles.js              ← Hero particle canvas animation
│   └── socials.js                ← Social link management (reads from localStorage)
├── pages/
│   ├── services.html             ← All services overview
│   ├── portfolio.html            ← Portfolio with filter
│   ├── pricing.html              ← Full pricing page
│   ├── about.html                ← About us
│   ├── testimonials.html         ← All testimonials
│   ├── contact.html              ← Contact form + FAQ
│   ├── admin.html                ← Admin dashboard (social links, inbox)
│   └── services/
│       ├── web-app-development.html
│       ├── video-editing.html
│       ├── graphics-design.html
│       ├── digital-marketing.html
│       └── email-marketing.html
└── images/
    ├── partner-logos/            ← Drop real partner logos here
    ├── portfolio/                ← Add portfolio project images here
    └── team/                     ← Add team photos here
```

---

## 🚀 Deploy to GitHub Pages

1. Push this folder to your GitHub repo (`https://github.com/darapet/Darapetech`)
2. In GitHub → Settings → Pages → Source: Deploy from branch → main → / (root) → Save
3. Your site will be live at `https://darapet.github.io/Darapetech/`

## 🚀 Deploy to Netlify (recommended — free, custom domain)

1. Drag and drop the `darapet-site` folder onto [netlify.com/drop](https://app.netlify.com/drop)
2. Or connect your GitHub repo for auto-deploy on every push

## 🚀 Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` inside the `darapet-site` folder
3. Follow the prompts

---

## ✏️ How to Edit Content

All content is in the HTML files — just open in any text editor (VS Code recommended).

| What to change | Where |
|---|---|
| Hero headline/slogan | `index.html` — `.hero-title` section |
| Services | `pages/services.html` and `pages/services/*.html` |
| Pricing | `pages/pricing.html` |
| Testimonials | `pages/testimonials.html` |
| About / Team | `pages/about.html` |
| Contact info (email, location) | `pages/contact.html` |
| Footer info | All pages — footer section |
| Colors | `css/main.css` — `:root` CSS variables at top |
| Fonts | `css/main.css` — `font-family` in `:root` |

---

## 🔗 Social Media Links (Admin Panel)

1. Open `pages/admin.html` in your browser
2. Click **Social Links** in the left sidebar
3. Enter your URLs for Facebook, X, Instagram, TikTok, LinkedIn, Fiverr, and Upwork
4. Click **Save All Social Links**

Links are saved to your browser's localStorage and automatically applied across the entire site.

> **To hard-code them permanently:** Open `js/socials.js` and replace the `default:` values with your actual URLs.

---

## 🎨 Customising Colors

Open `css/main.css` and find the `:root` block at the top:

```css
:root {
  --accent-1: #38bdf8;      /* Primary accent (cyan) */
  --accent-2: #818cf8;      /* Secondary accent (violet) */
  --bg-dark:  #050b18;      /* Page background */
  --accent-gradient: linear-gradient(135deg, #38bdf8, #818cf8);
  ...
}
```

Change `--accent-1` and `--accent-2` to match your brand colours. Everything updates automatically.

---

## 📧 Making the Contact Form Work

The form currently shows a success animation (frontend only). To make it actually send emails:

**Option A — Formspree (free, no backend needed):**
1. Go to [formspree.io](https://formspree.io) and create a free account
2. Create a new form and get your endpoint URL
3. In `pages/contact.html`, change the `<form>` tag to:
   ```html
   <form action="https://formspree.io/f/YOUR_ID" method="POST" id="contactForm">
   ```

**Option B — Netlify Forms (if hosted on Netlify):**
1. Add `netlify` attribute to the form tag:
   ```html
   <form netlify name="contact" id="contactForm">
   ```

---

## 🔒 Admin Panel

The admin panel (`pages/admin.html`) is frontend-only — it uses localStorage to store social links. To add a proper password-protected admin:

- Add Supabase Auth (backend phase)
- Or use a simple `.htpasswd` if hosted on Apache

---

## 📸 Adding Real Images

Replace the gradient placeholder divs in `.portfolio-img` with real `<img>` tags:

```html
<div class="portfolio-img">
  <img src="../images/portfolio/project-name.jpg" alt="Project Name" />
  ...
</div>
```

Image folder: `images/portfolio/` — add your project screenshots here.

---

## 🛠 Pages Summary

| Page | URL | Description |
|---|---|---|
| Home | `/index.html` | Full homepage with all sections |
| Services | `/pages/services.html` | All service categories |
| Web & App Dev | `/pages/services/web-app-development.html` | Detailed service page |
| Video Editing | `/pages/services/video-editing.html` | Detailed service page |
| Graphics & Design | `/pages/services/graphics-design.html` | Detailed service page |
| Digital Marketing | `/pages/services/digital-marketing.html` | Detailed service page |
| Email Marketing | `/pages/services/email-marketing.html` | Detailed service page |
| Portfolio | `/pages/portfolio.html` | Filterable portfolio grid |
| Testimonials | `/pages/testimonials.html` | All testimonials + video section |
| Pricing | `/pages/pricing.html` | Full pricing by service |
| About | `/pages/about.html` | Story, team, values |
| Contact | `/pages/contact.html` | Contact form + FAQ |
| Admin | `/pages/admin.html` | Social links settings + inbox |

---

&copy; 2025 Darapet Technology
