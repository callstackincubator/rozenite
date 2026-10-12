// Dev host fixtures for `rozenite dev`. They replay the messages the device
// side (`src/react-native/**`) sends, so the panel renders a realistic mix of
// traffic without a running app. Kept inline, like `packages/storage-plugin`'s
// dev fixtures: this file is evaluated without `require`, so only type-only
// imports are allowed.

type DevFlowMessage = {
  id: string;
  direction: 'in' | 'out';
  date: string;
  type: string;
  payload: unknown;
};

type DevFlowMessageMatcher =
  | string
  | ((message: DevFlowMessage) => boolean)
  | {
      type?: string;
      direction?: DevFlowMessage['direction'];
      predicate?: (message: DevFlowMessage) => boolean;
    };

type DevFlowContext = {
  signal: AbortSignal;
  send: (type: string, payload: unknown) => void;
  onMessage: (
    matcher: DevFlowMessageMatcher,
    listener: (message: DevFlowMessage) => void,
  ) => { remove: () => void };
  waitForMessage: (
    matcher: DevFlowMessageMatcher,
    options?: { timeoutMs?: number },
  ) => Promise<DevFlowMessage>;
};

type Headers = Record<string, string | string[]>;

type ResponseBody =
  | string
  | { kind: 'binary'; base64: string }
  | { kind: 'binary-too-large'; size: number }
  | null;

type HttpFixture = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  url: string;
  /** Milliseconds after the start of the capture window. */
  at: number;
  type?: 'Fetch' | 'XHR' | 'Other';
  source?: 'builtin' | 'expo' | 'nitro';
  requestHeaders?: Headers;
  postData?: unknown;
  outcome: 'finished' | 'failed' | 'pending' | 'loading';
  status?: number;
  statusText?: string;
  responseHeaders?: Headers;
  contentType?: string;
  body?: ResponseBody;
  ttfb?: number;
  duration?: number;
  error?: string;
  /** Percentage downloaded for `loading` requests. */
  progress?: number;
  initiator?: unknown;
};

const API = 'https://api.shop.dev';
const CAPTURE_WINDOW_MS = 14000;

const initiator = (
  functionName: string,
  file: string,
  lineNumber: number,
  columnNumber: number,
  extraFrames: Array<{ functionName: string; file: string; line: number; column: number }> = [],
) => ({
  type: 'script',
  symbolicationStatus: 'complete',
  functionName,
  url: `file:///Users/dev/shop/${file}`,
  lineNumber,
  columnNumber,
  generatedUrl: 'http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false',
  generatedLineNumber: 120000 + lineNumber * 7,
  generatedColumnNumber: columnNumber + 4,
  codeFrame: {
    fileName: file,
    location: { row: lineNumber, column: columnNumber },
    content: [
      `  ${lineNumber - 2} | export async function ${functionName}() {`,
      `  ${lineNumber - 1} |   const headers = await getAuthHeaders();`,
      `> ${lineNumber} |   const response = await fetch(url, { headers });`,
      `    | ${' '.repeat(columnNumber)}^`,
      `  ${lineNumber + 1} |   return response.json();`,
      `  ${lineNumber + 2} | }`,
    ].join('\n'),
  },
  stack: [
    {
      functionName,
      url: `file:///Users/dev/shop/${file}`,
      lineNumber,
      columnNumber,
      generatedUrl: 'http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false',
      generatedLineNumber: 120000 + lineNumber * 7,
      generatedColumnNumber: columnNumber + 4,
    },
    ...extraFrames.map((frame) => ({
      functionName: frame.functionName,
      url: `file:///Users/dev/shop/${frame.file}`,
      lineNumber: frame.line,
      columnNumber: frame.column,
    })),
  ],
});

const json = (value: unknown) => JSON.stringify(value);

const products = Array.from({ length: 6 }, (_, index) => ({
  id: `sku_${1001 + index}`,
  name: [
    'Trail Runner 2',
    'Ridge Shell Jacket',
    'Summit Pack 28L',
    'Merino Base Layer',
    'Gaiters',
    'Headlamp 400',
  ][index],
  price: { amount: [149, 229, 119, 79, 34, 59][index], currency: 'USD' },
  tags: ['outdoor', index % 2 ? 'sale' : 'new'],
  inStock: index !== 3,
  rating: [4.7, 4.5, 4.8, 4.2, 4.0, 4.6][index],
}));

const longSearchUrl =
  `${API}/v2/search/suggestions?q=trail+running+shoes+waterproof+gore-tex` +
  '&filters%5Bbrand%5D=salomon,hoka,altra,la-sportiva,brooks,saucony' +
  '&filters%5Bsize%5D=42&filters%5Bwidth%5D=regular&sort=relevance&locale=en-US' +
  '&session=9f2c1ab4-7d1e-4e7b-9a53-0c1d2b6f84aa&utm_source=app&utm_medium=search&utm_campaign=spring';

const multipartPostData = {
  type: 'form-data',
  value: {
    caption: { type: 'text', value: 'Morning trail run' },
    visibility: { type: 'text', value: 'friends' },
    photo: { type: 'binary', value: { size: 48211, type: 'image/png', name: 'trail.png' } },
  },
};

const httpFixtures: HttpFixture[] = [
  {
    id: 'req-products',
    method: 'GET',
    url: `${API}/v2/products?category=shoes&page=1&limit=24`,
    at: 0,
    type: 'Fetch',
    requestHeaders: {
      Accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.demo.signature',
      Cookie: 'session_id=7f3a2c19d0e4; theme=dark; ab_bucket=B',
      'User-Agent': 'ShopApp/4.2.0 CFNetwork/1494 Darwin/23.4.0',
    },
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=60',
      etag: 'W/"1a2b3c"',
      'set-cookie': [
        'session_id=7f3a2c19d0e4; Path=/; Domain=.shop.dev; Max-Age=3600; HttpOnly; Secure; SameSite=Lax',
        'csrf_token=Zm9vYmFy; Path=/; Secure; SameSite=Strict',
      ],
      'x-request-id': 'a9c4e1d2-55f0-4b7e',
    },
    contentType: 'application/json',
    body: json({ page: 1, total: 128, products }),
    ttfb: 96,
    duration: 142,
    initiator: initiator('fetchProducts', 'src/api/products.ts', 42, 18, [
      { functionName: 'useProducts', file: 'src/hooks/useProducts.ts', line: 17, column: 9 },
      { functionName: 'ProductList', file: 'src/screens/ProductList.tsx', line: 31, column: 5 },
    ]),
  },
  {
    id: 'req-profile',
    method: 'GET',
    url: `${API}/v2/user/profile`,
    at: 180,
    type: 'Fetch',
    requestHeaders: {
      Accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.demo.signature',
    },
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/json' },
    contentType: 'application/json',
    body: json({
      id: 'usr_8841',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      plan: 'pro',
      flags: { beta: true },
    }),
    ttfb: 54,
    duration: 88,
    initiator: initiator('fetchProfile', 'src/api/user.ts', 21, 12),
  },
  {
    id: 'req-image',
    method: 'GET',
    url: 'https://cdn.shop.dev/images/products/trail-runner-2/hero@2x.png',
    at: 420,
    type: 'Other',
    requestHeaders: { Accept: 'image/png,image/*;q=0.8' },
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: {
      'content-type': 'image/png',
      'content-length': '13453',
      'cache-control': 'public, max-age=31536000, immutable',
    },
    contentType: 'image/png',
    body: { kind: 'binary', base64: '__CANVAS_PNG__' },
    ttfb: 120,
    duration: 231,
    initiator: { type: 'other' },
  },
  {
    id: 'req-svg',
    method: 'GET',
    url: 'https://cdn.shop.dev/brand/logo.svg',
    at: 460,
    type: 'Other',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'image/svg+xml' },
    contentType: 'image/svg+xml',
    body:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
      '<rect width="64" height="64" fill="#1f2937"/><path d="M12 44 L32 12 L52 44 Z" fill="#f43f5e"/>' +
      '<circle cx="32" cy="38" r="6" fill="#fde68a"/></svg>',
    ttfb: 30,
    duration: 47,
    initiator: { type: 'other' },
  },
  {
    id: 'req-order',
    method: 'POST',
    url: `${API}/v2/orders`,
    at: 900,
    type: 'Fetch',
    requestHeaders: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.demo.signature',
      'Idempotency-Key': '5d1c0e8e-3f0b-4c61-b0fa-2f7f8d3a9c11',
    },
    postData: {
      type: 'text',
      value: json({
        items: [
          { sku: 'sku_1001', qty: 1 },
          { sku: 'sku_1005', qty: 2 },
        ],
        shipping: { method: 'express', address: { city: 'Wroclaw', country: 'PL' } },
        coupon: null,
      }),
    },
    outcome: 'finished',
    status: 201,
    statusText: 'Created',
    responseHeaders: {
      'content-type': 'application/json',
      location: '/v2/orders/ord_4471',
    },
    contentType: 'application/json',
    body: json({ id: 'ord_4471', status: 'confirmed', total: { amount: 217, currency: 'USD' } }),
    ttfb: 188,
    duration: 241,
    initiator: initiator('placeOrder', 'src/api/orders.ts', 58, 22, [
      { functionName: 'onCheckoutPress', file: 'src/screens/Checkout.tsx', line: 88, column: 11 },
    ]),
  },
  {
    id: 'req-upload',
    method: 'POST',
    url: `${API}/v2/uploads`,
    at: 1500,
    type: 'XHR',
    requestHeaders: { Accept: 'application/json' },
    postData: multipartPostData,
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/json' },
    contentType: 'application/json',
    body: json({ uploadId: 'upl_92', url: 'https://cdn.shop.dev/u/upl_92.png' }),
    ttfb: 410,
    duration: 622,
    initiator: initiator('uploadPhoto', 'src/api/uploads.ts', 33, 16),
  },
  {
    id: 'req-catalog-xml',
    method: 'GET',
    url: `${API}/v2/catalog.xml`,
    at: 1900,
    type: 'Fetch',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/xml' },
    contentType: 'application/xml',
    body:
      '<?xml version="1.0" encoding="UTF-8"?>\n<catalog updated="2026-03-02">\n' +
      '  <item id="sku_1001" featured="true"><name>Trail Runner 2</name><price currency="USD">149</price></item>\n' +
      '  <item id="sku_1002"><name>Ridge Shell Jacket</name><price currency="USD">229</price></item>\n' +
      '  <note><![CDATA[Prices exclude tax & shipping]]></note>\n</catalog>',
    ttfb: 70,
    duration: 133,
    initiator: initiator('fetchCatalog', 'src/api/catalog.ts', 14, 10),
  },
  {
    id: 'req-recommendations',
    method: 'GET',
    url: `${API}/v2/recommendations?user=usr_8841`,
    at: 2300,
    type: 'Fetch',
    requestHeaders: { 'If-None-Match': 'W/"9f8e7d"' },
    outcome: 'finished',
    status: 304,
    statusText: 'Not Modified',
    responseHeaders: { etag: 'W/"9f8e7d"', 'cache-control': 'private, max-age=300' },
    contentType: 'application/json',
    body: null,
    ttfb: 28,
    duration: 41,
    initiator: initiator('fetchRecommendations', 'src/api/recommendations.ts', 9, 14),
  },
  {
    id: 'req-redirect',
    method: 'GET',
    url: `${API}/v2/go/spring-sale`,
    at: 2500,
    type: 'Fetch',
    outcome: 'finished',
    status: 302,
    statusText: 'Found',
    responseHeaders: { location: '/v2/promotions/spring-sale', 'content-length': '0' },
    contentType: 'text/plain',
    body: null,
    ttfb: 22,
    duration: 30,
    initiator: initiator('openPromotion', 'src/api/promotions.ts', 27, 8),
  },
  {
    id: 'req-html',
    method: 'GET',
    url: `${API}/v2/promotions/spring-sale`,
    at: 2600,
    type: 'Fetch',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'text/html; charset=utf-8' },
    contentType: 'text/html',
    body:
      '<!doctype html><html><head><style>body{font-family:sans-serif;padding:16px;background:#fff7ed}' +
      'h1{color:#9a3412}</style></head><body><h1>Spring sale</h1><p>Up to <b>40%</b> off trail gear.</p>' +
      '<ul><li>Shoes</li><li>Jackets</li><li>Packs</li></ul></body></html>',
    ttfb: 66,
    duration: 98,
    initiator: initiator('openPromotion', 'src/api/promotions.ts', 27, 8),
  },
  {
    id: 'req-search-long',
    method: 'GET',
    url: longSearchUrl,
    at: 3100,
    type: 'Fetch',
    source: 'nitro',
    requestHeaders: { Accept: 'application/json' },
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/json' },
    contentType: 'application/json',
    body: json({ suggestions: ['trail runner 2', 'trail running vest', 'trail running socks'] }),
    ttfb: 140,
    duration: 205,
    initiator: initiator('fetchSuggestions', 'src/api/search.ts', 19, 20),
  },
  {
    id: 'req-session-401',
    method: 'GET',
    url: `${API}/v2/session/refresh`,
    at: 3600,
    type: 'Fetch',
    source: 'expo',
    requestHeaders: { Authorization: 'Bearer expired.token.value' },
    outcome: 'finished',
    status: 401,
    statusText: 'Unauthorized',
    responseHeaders: {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer realm="shop"',
    },
    contentType: 'application/json',
    body: json({ error: { code: 'token_expired', message: 'The access token expired' } }),
    ttfb: 64,
    duration: 79,
    initiator: initiator('refreshSession', 'src/auth/session.ts', 64, 15),
  },
  {
    id: 'req-cart-500',
    method: 'GET',
    url: `${API}/v2/cart`,
    at: 4400,
    type: 'Fetch',
    requestHeaders: { Accept: 'application/json', Cookie: 'session_id=7f3a2c19d0e4' },
    outcome: 'finished',
    status: 500,
    statusText: 'Internal Server Error',
    responseHeaders: { 'content-type': 'application/json', 'x-request-id': '7f3a2c19-d0e4' },
    contentType: 'application/json',
    body: json({ error: 'upstream_timeout', requestId: '7f3a2c19-d0e4', retryable: true }),
    ttfb: 186,
    duration: 212,
    initiator: initiator('fetchCart', 'src/api/cart.ts', 12, 18),
  },
  {
    id: 'req-cart-put',
    method: 'PUT',
    url: `${API}/v2/cart/items/sku_1001`,
    at: 5200,
    type: 'Fetch',
    requestHeaders: { 'Content-Type': 'application/json' },
    postData: { type: 'text', value: json({ qty: 3 }) },
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/json' },
    contentType: 'application/json',
    body: json({ sku: 'sku_1001', qty: 3 }),
    ttfb: 80,
    duration: 119,
    initiator: initiator('updateCartItem', 'src/api/cart.ts', 40, 14),
  },
  {
    id: 'req-wishlist-patch',
    method: 'PATCH',
    url: `${API}/v2/wishlist/lists/lst_12`,
    at: 5600,
    type: 'XHR',
    requestHeaders: { 'Content-Type': 'application/json' },
    postData: { type: 'text', value: json({ name: 'Spring run' }) },
    outcome: 'finished',
    status: 204,
    statusText: 'No Content',
    responseHeaders: {},
    contentType: 'application/json',
    body: null,
    ttfb: 40,
    duration: 55,
    initiator: initiator('renameList', 'src/api/wishlist.ts', 25, 12),
  },
  {
    id: 'req-delete',
    method: 'DELETE',
    url: `${API}/v2/cart/items/sku_1005`,
    at: 6400,
    type: 'Fetch',
    outcome: 'finished',
    status: 404,
    statusText: 'Not Found',
    responseHeaders: { 'content-type': 'application/json' },
    contentType: 'application/json',
    body: json({ error: 'not_found' }),
    ttfb: 48,
    duration: 61,
    initiator: initiator('removeCartItem', 'src/api/cart.ts', 52, 14),
  },
  {
    id: 'req-pdf',
    method: 'GET',
    url: `${API}/v2/orders/ord_4471/invoice.pdf`,
    at: 7000,
    type: 'Other',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="invoice-4471.pdf"',
      'content-length': '288',
    },
    contentType: 'application/pdf',
    body: {
      kind: 'binary',
      base64:
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=',
    },
    ttfb: 150,
    duration: 380,
    initiator: initiator('downloadInvoice', 'src/api/orders.ts', 91, 10),
  },
  {
    id: 'req-video',
    method: 'GET',
    url: 'https://cdn.shop.dev/media/promo-spring.mp4',
    at: 7600,
    type: 'Other',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'video/mp4', 'content-length': '9437184' },
    contentType: 'video/mp4',
    body: { kind: 'binary-too-large', size: 9437184 },
    ttfb: 220,
    duration: 1840,
    initiator: { type: 'other' },
  },
  {
    id: 'req-analytics-failed',
    method: 'POST',
    url: 'https://tracking.analytics.io/v1/collect',
    at: 8200,
    type: 'Fetch',
    requestHeaders: { 'Content-Type': 'application/json' },
    postData: { type: 'text', value: json({ event: 'screen_view', screen: 'ProductList' }) },
    outcome: 'failed',
    error: 'Network request failed',
    duration: 3100,
    initiator: initiator('track', 'src/analytics/track.ts', 11, 9),
  },
  {
    id: 'req-text',
    method: 'GET',
    url: `${API}/v2/health`,
    at: 9000,
    type: 'Fetch',
    outcome: 'finished',
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'text/plain' },
    contentType: 'text/plain',
    body: 'ok\nuptime=18d 3h\nregion=eu-central-1',
    ttfb: 18,
    duration: 26,
    initiator: initiator('ping', 'src/api/health.ts', 6, 12),
  },
  {
    id: 'req-reviews-loading',
    method: 'GET',
    url: `${API}/v2/products/sku_1001/reviews?limit=500`,
    at: 11800,
    type: 'Fetch',
    outcome: 'loading',
    progress: 45,
    status: 200,
    statusText: 'OK',
    responseHeaders: { 'content-type': 'application/json', 'content-length': '482113' },
    contentType: 'application/json',
    ttfb: 110,
    initiator: initiator('fetchReviews', 'src/api/reviews.ts', 18, 16),
  },
  {
    id: 'req-pending',
    method: 'GET',
    url: `${API}/v2/inventory/stores?lat=51.1079&lng=17.0385&radius=25`,
    at: 12900,
    type: 'XHR',
    outcome: 'pending',
    initiator: initiator('fetchStores', 'src/api/stores.ts', 30, 14),
  },
];

const sseFixture = {
  id: 'req-sse-prices',
  url: `${API}/v2/stream/prices?symbols=SKU1001,SKU1002`,
  at: 6000,
  messages: [
    { type: 'price', data: json({ sku: 'sku_1001', amount: 149 }), at: 6400 },
    { type: 'price', data: json({ sku: 'sku_1002', amount: 229 }), at: 7600 },
    { type: 'heartbeat', data: 'ping', at: 9000 },
    {
      type: 'price',
      data: json({ sku: 'sku_1001', amount: 139, reason: 'flash-sale' }),
      at: 10800,
    },
    {
      type: 'message',
      data: json({ notice: 'Stream stays open', nested: { retryMs: 3000 } }),
      at: 12200,
    },
  ],
};

const webSocketFixtures = [
  {
    socketId: '1',
    url: 'wss://realtime.shop.dev/socket?token=demo',
    at: 800,
    closedAt: null as number | null,
    messages: [
      {
        direction: 'sent',
        data: json({ type: 'subscribe', channels: ['inventory', 'orders'] }),
        at: 1000,
      },
      {
        direction: 'received',
        data: json({ type: 'subscribed', channels: ['inventory', 'orders'] }),
        at: 1090,
      },
      {
        direction: 'received',
        data: json({ type: 'inventory.update', sku: 'sku_1001', stock: 14 }),
        at: 3000,
      },
      { direction: 'sent', data: 'ping', at: 6000 },
      { direction: 'received', data: 'pong', at: 6040 },
      {
        direction: 'received',
        data: json({ type: 'order.status', id: 'ord_4471', status: 'packed' }),
        at: 10400,
      },
    ],
  },
  {
    socketId: '2',
    url: 'wss://chat.shop.dev/support',
    at: 2800,
    closedAt: 9400 as number | null,
    messages: [
      { direction: 'sent', data: 'Hi, where is my order?', at: 3300 },
      { direction: 'received', data: 'Hello! Let me check order ord_4471 for you.', at: 3900 },
    ],
  },
];

const buildPngBase64 = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }
  const gradient = ctx.createLinearGradient(0, 0, 160, 100);
  gradient.addColorStop(0, '#0ea5e9');
  gradient.addColorStop(1, '#f43f5e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 160, 100);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 0; x < 160; x += 20) {
    ctx.fillRect(x, 70 - (x % 40), 10, 30 + (x % 40));
  }
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};

const runNetworkFixtures = async ({ send, onMessage, waitForMessage, signal }: DevFlowContext) => {
  await waitForMessage({ type: 'get-client-ui-settings', direction: 'out' }, { timeoutMs: 10000 });

  const start = Date.now() - CAPTURE_WINDOW_MS;
  const at = (offset: number) => start + offset;
  const png = buildPngBase64();
  const bodies = new Map<string, ResponseBody>();

  httpFixtures.forEach((fixture) => {
    const sentAt = at(fixture.at);
    const body =
      fixture.body && typeof fixture.body === 'object' && fixture.body.kind === 'binary'
        ? {
            kind: 'binary' as const,
            base64: fixture.body.base64 === '__CANVAS_PNG__' ? png : fixture.body.base64,
          }
        : (fixture.body ?? null);
    bodies.set(fixture.id, body);

    send('request-sent', {
      requestId: fixture.id,
      timestamp: sentAt,
      type: fixture.type ?? 'Fetch',
      source: fixture.source,
      initiator: fixture.initiator ?? { type: 'other' },
      request: {
        url: fixture.url,
        method: fixture.method,
        headers: fixture.requestHeaders ?? {},
        postData: fixture.postData,
      },
    });

    if (fixture.outcome === 'failed') {
      send('request-failed', {
        requestId: fixture.id,
        timestamp: sentAt + (fixture.duration ?? 0),
        type: fixture.type ?? 'Fetch',
        error: fixture.error ?? 'Network request failed',
        canceled: false,
        source: fixture.source,
      });
      return;
    }

    if (fixture.outcome === 'pending') {
      return;
    }

    const size = typeof body === 'string' ? body.length : body && 'size' in body ? body.size : null;
    const sentResponse = {
      url: fixture.url,
      status: fixture.status ?? 200,
      statusText: fixture.statusText ?? 'OK',
      headers: fixture.responseHeaders ?? {},
      contentType: fixture.contentType ?? 'application/json',
      size: fixture.outcome === 'loading' ? 482113 : size,
      responseTime: sentAt + (fixture.ttfb ?? 0),
    };

    send('response-received', {
      requestId: fixture.id,
      timestamp: sentAt + (fixture.ttfb ?? 0),
      type: fixture.type ?? 'Fetch',
      source: fixture.source,
      response: sentResponse,
    });

    if (fixture.outcome === 'loading') {
      send('request-progress', {
        requestId: fixture.id,
        timestamp: Date.now(),
        loaded: Math.round((482113 * (fixture.progress ?? 0)) / 100),
        total: 482113,
        lengthComputable: true,
        source: fixture.source,
      });
      return;
    }

    send('request-completed', {
      requestId: fixture.id,
      timestamp: sentAt + (fixture.duration ?? 0),
      duration: fixture.duration ?? 0,
      size,
      ttfb: fixture.ttfb ?? 0,
      source: fixture.source,
    });
  });

  // Server-sent events. The device side first records the request, then
  // reports the stream as open.
  send('request-sent', {
    requestId: sseFixture.id,
    timestamp: at(sseFixture.at),
    type: 'Other',
    initiator: initiator('subscribePrices', 'src/api/prices.ts', 22, 14),
    request: {
      url: sseFixture.url,
      method: 'GET',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
    },
  });
  send('sse-open', {
    type: 'sse-open',
    requestId: sseFixture.id,
    timestamp: at(sseFixture.at + 90),
    response: {
      url: sseFixture.url,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      contentType: 'text/event-stream',
      size: 0,
      responseTime: at(sseFixture.at + 90),
    },
  });
  sseFixture.messages.forEach((message) => {
    send('sse-message', {
      type: 'sse-message',
      requestId: sseFixture.id,
      timestamp: at(message.at),
      payload: { type: message.type, data: message.data },
    });
  });

  // WebSockets.
  webSocketFixtures.forEach((socket) => {
    send('websocket-connect', {
      type: 'websocket-connect',
      url: socket.url,
      socketId: socket.socketId,
      timestamp: at(socket.at),
      protocols: ['v1.shop'],
      options: [],
    });
    send('websocket-open', {
      type: 'websocket-open',
      url: socket.url,
      socketId: socket.socketId,
      timestamp: at(socket.at + 120),
    });
    socket.messages.forEach((message) => {
      send(message.direction === 'sent' ? 'websocket-message-sent' : 'websocket-message-received', {
        type:
          message.direction === 'sent' ? 'websocket-message-sent' : 'websocket-message-received',
        url: socket.url,
        socketId: socket.socketId,
        timestamp: at(message.at),
        data: message.data,
        messageType: 'text',
      });
    });
    if (socket.closedAt !== null) {
      send('websocket-close', {
        type: 'websocket-close',
        url: socket.url,
        socketId: socket.socketId,
        timestamp: at(socket.closedAt),
        code: 1000,
        reason: 'Normal closure',
      });
    }
  });

  send('websocket-connect', {
    type: 'websocket-connect',
    url: 'wss://legacy.shop.dev/feed',
    socketId: '3',
    timestamp: at(8800),
    protocols: null,
    options: [],
  });
  send('websocket-error', {
    type: 'websocket-error',
    url: 'wss://legacy.shop.dev/feed',
    socketId: '3',
    timestamp: at(9300),
    error: 'Connection refused',
  });

  // Serve response bodies on demand, like the device does.
  onMessage({ type: 'get-response-body', direction: 'out' }, (message) => {
    const { requestId } = message.payload as { requestId: string };
    send('response-body', { requestId, body: bodies.get(requestId) ?? null });
  });

  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

  return { requests: httpFixtures.length + 1, webSockets: webSocketFixtures.length + 1 };
};

export default {
  integrations: ['react-native'],
  panels: [
    {
      name: 'Network Activity',
      source: './src/ui/App.tsx',
    },
  ],
  dev: {
    presets: [
      {
        name: 'Show URL as request name',
        type: 'client-ui-settings',
        payload: { settings: { showUrlAsName: true } },
      },
      {
        name: 'Device reports recording stopped',
        type: 'recording-state',
        payload: { isRecording: false },
      },
    ],
    flows: [
      {
        name: 'Populate Network Activity',
        autoRun: true,
        run: runNetworkFixtures,
      },
    ],
  },
};
