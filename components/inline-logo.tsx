export const InlineRadarLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    {/* Outer circle */}
    <circle cx="80" cy="80" r="78" stroke="white" strokeWidth="2" fill="none" />

    {/* Middle circle */}
    <circle cx="80" cy="80" r="50" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.7" />

    {/* Inner circle */}
    <circle cx="80" cy="80" r="20" stroke="white" strokeWidth="1" fill="none" strokeOpacity="0.5" />

    {/* Center dot */}
    <circle cx="80" cy="80" r="3" fill="white" />

    {/* Radar line */}
    <line x1="80" y1="80" x2="80" y2="2" stroke="white" strokeWidth="2" transform="rotate(45, 80, 80)" />

    {/* Crosshairs */}
    <line x1="80" y1="10" x2="80" y2="150" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
    <line x1="10" y1="80" x2="150" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.5" />

    {/* Blip */}
    <circle cx="110" cy="50" r="4" fill="white" />
  </svg>
)

export const BASE64_RADAR_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIiB2aWV3Qm94PSIwIDAgMTYwIDE2MCI+PGNpcmNsZSBjeD0iODAiIGN5PSI4MCIgcj0iNzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjgwIiBjeT0iODAiIHI9IjUwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLW9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjgwIiBjeT0iODAiIHI9IjIwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIHN0cm9rZS1vcGFjaXR5PSIwLjUiLz48Y2lyY2xlIGN4PSI4MCIgY3k9IjgwIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPjxsaW5lIHgxPSI4MCIgeTE9IjgwIiB4Mj0iODAiIHkyPSIyIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHRyYW5zZm9ybT0icm90YXRlKDQ1LCA4MCwgODApIi8+PGxpbmUgeDE9IjgwIiB5MT0iMTAiIHgyPSI4MCIgeTI9IjE1MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2Utb3BhY2l0eT0iMC41Ii8+PGxpbmUgeDE9IjEwIiB5MT0iODAiIHgyPSIxNTAiIHkyPSI4MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2Utb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iMTEwIiBjeT0iNTAiIHI9IjQiIGZpbGw9IndoaXRlIi8+PC9zdmc+"
