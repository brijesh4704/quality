// mock-dms.js — Simulates /api/dms/search API

(function(){
  const mockData = {
    "1HGCM82633A123456": [
      { title: "CVIC Inspection Report", type: "PDF", url: "assets/docs/cvic_inspection.pdf" },
      { title: "Double Check Sheet", type: "Image", url: "assets/docs/doublecheck.jpg" },
      { title: "Port Return Sheet", type: "PDF", url: "assets/docs/portreturn.pdf" }
    ],
    "2HGFB2F5XEH123789": [
      { title: "Engine Quality Report", type: "PDF", url: "assets/docs/engine_quality.pdf" },
      { title: "Trim Inspection", type: "Image", url: "assets/docs/trim.jpg" }
    ]
  };

  // Override window.fetch for /api/dms/search
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if(url.startsWith('/api/dms/search?vin=')){
      const vin = decodeURIComponent(url.split('=')[1]);
      const docs = mockData[vin] || [];
      return Promise.resolve(new Response(JSON.stringify({ docs }), {status:200}));
    }
    return originalFetch.apply(this, arguments);
  };
})();
