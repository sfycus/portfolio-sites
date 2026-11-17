const config = window.PORTFOLIO_CONFIG;
const host = window.location.hostname.toLowerCase();
const inferredOwner = host.endsWith('.github.io') ? host.slice(0, -'.github.io'.length) : '';
const owner = (config.githubOwner || inferredOwner).trim();
const grid = document.querySelector('#projectGrid');
const profileLink = document.querySelector('#profileLink');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

if (owner) {
  profileLink.href = `https://github.com/${encodeURIComponent(owner)}`;
  profileLink.hidden = false;
}

grid.innerHTML = config.projects.map((project, index) => {
  const number = String(index + 1).padStart(2, '0');
  const url = `sites/${encodeURIComponent(project.slug)}/`;
  const source = owner ? `<a class="source-link" href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(project.repo)}" target="_blank" rel="noopener noreferrer">Исходный код ↗</a>` : '';
  return `<article class="project-card">
    <div class="card-index"><span>${number} / ${escapeHtml(project.category)}</span><span>${escapeHtml(project.slug)}</span></div>
    <a class="card-image" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Открыть сайт ${escapeHtml(project.name)}">
      <img src="assets/${encodeURIComponent(project.image)}" alt="${escapeHtml(project.alt)}" loading="lazy" decoding="async">
      <span class="image-arrow" aria-hidden="true">↗</span>
    </a>
    <div class="card-copy"><div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p></div><p class="feature-line">${escapeHtml(project.features)}</p></div>
    <div class="card-actions"><a class="site-link" href="${url}" target="_blank" rel="noopener noreferrer">Открыть сайт <span aria-hidden="true">↗</span></a>${source}</div>
  </article>`;
}).join('');
