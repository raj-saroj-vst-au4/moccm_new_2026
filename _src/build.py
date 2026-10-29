"""Wrap page bodies (pages/<name>.html) in the shared header/footer and write to /srv/www/motilal.

Each body file starts with three comment lines:
<!-- title: ... -->
<!-- description: ... -->
<!-- nav: index|about|ecosystem|research|programs|careers|contact -->
The token {{GRAPH}} is replaced with the network-graph SVG.
"""
import hashlib, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
OUT = pathlib.Path("/srv/www/motilal")
GRAPH = (HERE / "graph.svg.txt").read_text().strip()

NAV = [("index", "Home"), ("about", "About"), ("ecosystem", "Ecosystem"), ("research", "Research"),
       ("programs", "Programs"), ("careers", "Careers"), ("contact", "Contact")]

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="author" content="Motilal Oswal Centre for Capital Markets, IIT Bombay">
  <meta name="theme-color" content="#0a1e37">
{extra}  <link rel="icon" type="image/png" href="motilal_images/web/favicon.png">
  <link rel="apple-touch-icon" href="motilal_images/web/favicon.png">
  <link rel="preload" href="assets/fonts/archivo-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/source-serif-4-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/fonts/fonts.css">
  <link rel="stylesheet" href="assets/site.css">
  <link rel="stylesheet" href="assets/motion.css">
{loader_head}</head>
<body class="page-{nav}">
{loader_body}<a class="skip" href="#main">Skip to content</a>
<header class="site-header is-dark">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="Motilal Oswal Centre for Capital Markets, IIT Bombay — home">
      <img class="iitb on-light" src="motilal_images/web/iitblogodark.png" alt="IIT Bombay" width="240" height="234">
      <img class="iitb on-dark" src="motilal_images/web/iitblogo.png" alt="" width="240" height="234">
      <span class="bar" aria-hidden="true"></span>
      <img class="moccm on-light" src="motilal_images/web/moccm-logo.png" alt="Motilal Oswal Centre for Capital Markets" width="640" height="247">
      <img class="moccm on-dark" src="motilal_images/web/moccm-logo-light.png" alt="" width="640" height="247">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="bars" aria-hidden="true"></span>Menu</button>
    <nav class="nav" id="site-nav" aria-label="Main">
      <ul>
{navlinks}
      </ul>
    </nav>
  </div>
</header>
<main id="main">
"""

FOOT = """</main>
<footer class="site-footer">
  <div class="wrap">
    <div>
      <h2>Motilal Oswal Centre for Capital Markets</h2>
      <p>Indian Institute of Technology Bombay<br>Industry-defined. Academia-led. Action-focused.</p>
    </div>
    <div>
      <h3>Contact</h3>
      <address>
        IIT Bombay, Powai, Mumbai – 400076<br>
        <a href="mailto:sonti@iitb.ac.in">sonti[at]iitb.ac.in</a><br>
        <a href="mailto:program.director.moccm@iitb.ac.in">program.director.moccm[at]iitb.ac.in</a>
      </address>
    </div>
    <nav aria-label="Footer">
      <h3>Explore</h3>
      <ul>
{footlinks}
      </ul>
    </nav>
    <p class="legal">© 2026 Motilal Oswal Centre for Capital Markets, IIT Bombay. All rights reserved.</p>
  </div>
</footer>
<script src="assets/vendor/gsap.min.js" defer></script>
<script src="assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/vendor/SplitText.min.js" defer></script>
<script src="assets/vendor/lenis.min.js" defer></script>
<script src="assets/site.js" defer></script>
<script src="assets/motion.js" defer></script>
{scripts}</body>
</html>
"""


# ---- Loader (pages with "<!-- loader: 1 -->"): covers the page until the intro animation is ready.
# The inline script shows it from first paint and guarantees it lifts: on the intro's signal, soon
# after page load if the intro script never started, or after 8 s whatever happens. Without
# JavaScript, with reduced motion, or with ?static there is no loader at all.
LOADER_HEAD = """  <script>
    (function () {
      var d = document.documentElement;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]static\\b/.test(location.search)) return;
      // the intro is where this page begins: a reload starts at the top, not part-way through it
      // (Back/Forward still returns to where the visitor was)
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      d.classList.add('is-loading');
      var finished = false, shown = 0, resolve;
      var ready = new Promise(function (r) { resolve = r; });
      function progress(p) { if (p > shown) { shown = p; d.style.setProperty('--load', p); } }
      function done() {
        if (finished) return;
        finished = true;
        progress(1);
        d.classList.remove('is-loading');
        d.classList.add('is-loaded');
        resolve();
      }
      window.__loader = { ready: ready, progress: progress, done: done };
      progress(0.12);
      // module scripts run before DOMContentLoaded, so if the intro hasn't started by then it never will
      document.addEventListener('DOMContentLoaded', function () {
        progress(0.3);
        if (!window.__introStarted) done();
      });
      setTimeout(done, 8000);
    })();
  </script>
"""


def loader_mark():
    """The MOCCM network (same nodes and edges as the hero graph), drawn by the loader."""
    nodes = [(20,600,8),(110,470,9),(210,500,8),(235,585,9),(320,380,10),(380,455,9),(470,520,9),(520,350,10),(600,410,9),(640,250,10),(730,300,9),(760,170,10),(880,70,14),(905,215,11)]
    edges = [(0,1),(0,2),(1,2),(1,3),(2,3),(2,4),(3,4),(4,5),(4,7),(5,6),(5,7),(6,7),(6,8),(7,8),(7,9),(8,9),(8,10),(9,10),(9,11),(10,12),(10,13),(11,12),(11,13),(12,13),(8,12)]
    gold = {9, 10, 11, 12, 13}
    out = ['<svg class="loader-mark" viewBox="-30 30 980 600" focusable="false">']
    for i, (a, b) in enumerate(edges):
        g = " g" if b in gold else ""
        out.append(f'<line class="e{g}" style="--d:{i}" pathLength="1" x1="{nodes[a][0]}" y1="{nodes[a][1]}" x2="{nodes[b][0]}" y2="{nodes[b][1]}"/>')
    for i, (x, y, r) in enumerate(nodes):
        d = min(k for k, (a, b) in enumerate(edges) if i in (a, b)) + 1
        g = " g" if i in gold else ""
        out.append(f'<circle class="n{g}" style="--d:{d}" cx="{x}" cy="{y}" r="{round(r * 2.2)}"/>')
    out.append("</svg>")
    return "".join(out)


LOADER_BODY = """<div class="loader" aria-hidden="true">
  {mark}
  <div class="loader-bar"><span></span></div>
  <p class="loader-name">Motilal Oswal Centre for Capital Markets</p>
</div>
"""


def stamp(path):
    """Short content hash so browsers fetch an asset again whenever it changes."""
    return hashlib.sha1((OUT / path).read_bytes()).hexdigest()[:8]


def build(name):
    src = (HERE / "pages" / f"{name}.html").read_text()
    meta = dict(re.findall(r"<!-- (\w+): (.*?) -->", src.split("\n\n", 1)[0]))
    body = re.sub(r"\A(?:<!-- \w+: .*? -->\n)+", "", src).replace("{{GRAPH}}", GRAPH)
    active = meta.get("nav", name)
    links = "\n".join(
        f'        <li><a href="{k}.html"{" aria-current=\"page\"" if k == active else ""}>{label}</a></li>'
        for k, label in NAV)
    foot = "\n".join(f'        <li><a href="{k}.html">{label}</a></li>' for k, label in NAV[1:])
    extra = meta.get("extra", "")
    extra = f"  {extra}\n" if extra else ""
    scripts = "".join(f'<script src="{s.strip()}" defer></script>\n' for s in meta.get("scripts", "").split(",") if s.strip())
    scripts += "".join(f'<script type="module" src="{s.strip()}"></script>\n' for s in meta.get("modules", "").split(",") if s.strip())
    loader = meta.get("loader") == "1"
    html = HEAD.format(title=meta["title"], description=meta["description"], extra=extra, nav=active, navlinks=links,
                       loader_head=LOADER_HEAD if loader else "",
                       loader_body=LOADER_BODY.format(mark=loader_mark()) if loader else "") \
        + body.rstrip() + "\n" + FOOT.format(footlinks=foot, scripts=scripts)
    html = re.sub(r'"(assets/[\w./-]+\.(?:css|js))"', lambda m: f'"{m.group(1)}?v={stamp(m.group(1))}"', html)
    (OUT / f"{name}.html").write_text(html)
    print("built", name)


if __name__ == "__main__":
    names = sys.argv[1:] or [p.stem for p in (HERE / "pages").glob("*.html")]
    for n in names:
        build(n)
