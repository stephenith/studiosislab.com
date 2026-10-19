/**
 * Site-wide Google Tag Manager container GTM-PZWQCCDC.
 * The bootstrap is a server-rendered script so the browser runs it once while
 * parsing the initial document. Root layout stays mounted across App Router
 * navigations, so client transitions do not install the container again.
 * `w[l]=w[l]||[]` keeps any dataLayer already created by the existing GA4 snippet.
 */

export const GTM_CONTAINER_ID = "GTM-PZWQCCDC";

const GTM_BOOTSTRAP = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PZWQCCDC');`;

const GTM_NOSCRIPT = `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PZWQCCDC" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;

export function GoogleTagManagerHead() {
  return <script id="gtm-bootstrap" dangerouslySetInnerHTML={{ __html: GTM_BOOTSTRAP }} />;
}

export function GoogleTagManagerNoScript() {
  return <noscript dangerouslySetInnerHTML={{ __html: GTM_NOSCRIPT }} />;
}
