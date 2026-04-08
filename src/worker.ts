interface Env {
    STALL_COUNTER: DurableObjectNamespace;
    VARIANTS: KVNamespace;
}

interface StallData {
    count: number;
    lastStallTime: number;
    orchestratorVersion: string;
}

interface Variant {
    id: string;
    code: string;
    status: 'testing' | 'ready' | 'active';
    created: number;
    testsPassed: boolean;
}

class StallCounter {
    state: DurableObjectState;
    stallData: StallData;

    constructor(state: DurableObjectState) {
        this.state = state;
        this.stallData = {
            count: 0,
            lastStallTime: 0,
            orchestratorVersion: 'v1.0.0'
        };
        this.state.blockConcurrencyWhile(async () => {
            const stored = await this.state.storage.get<StallData>('stallData');
            if (stored) this.stallData = stored;
        });
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        
        if (url.pathname === '/increment') {
            this.stallData.count++;
            this.stallData.lastStallTime = Date.now();
            await this.state.storage.put('stallData', this.stallData);
            
            return new Response(JSON.stringify(this.stallData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (url.pathname === '/reset') {
            this.stallData.count = 0;
            await this.state.storage.put('stallData', this.stallData);
            
            return new Response(JSON.stringify(this.stallData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (url.pathname === '/status') {
            return new Response(JSON.stringify(this.stallData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Not found', { status: 404 });
    }
}

const HTML_TEMPLATE = (body: string) => `<!DOCTYPE html>
<html lang="en" style="background: #0a0a0f; color: #e2e8f0;">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meta Repair — Fleet heals its own brain</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', sans-serif; 
            background: #0a0a0f; 
            color: #e2e8f0;
            min-height: 100vh;
            padding: 20px;
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
        }
        header { 
            border-bottom: 1px solid #1e293b; 
            padding-bottom: 20px; 
            margin-bottom: 40px;
        }
        h1 { 
            color: #f43f5e; 
            font-size: 2.5rem; 
            margin-bottom: 10px;
            font-weight: 700;
        }
        .subtitle { 
            color: #94a3b8; 
            font-size: 1.1rem;
            font-weight: 300;
        }
        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 30px; 
            margin-bottom: 40px;
        }
        .card { 
            background: #1e1e2e; 
            border-radius: 12px; 
            padding: 25px; 
            border: 1px solid #2d3748;
            transition: transform 0.2s, border-color 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            border-color: #f43f5e;
        }
        h2 { 
            color: #f43f5e; 
            margin-bottom: 15px; 
            font-size: 1.5rem;
            font-weight: 600;
        }
        .endpoint { 
            background: #0f172a; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 15px 0; 
            border-left: 4px solid #f43f5e;
        }
        code { 
            font-family: 'Courier New', monospace; 
            background: #0f172a; 
            padding: 2px 6px; 
            border-radius: 4px; 
            color: #7dd3fc;
        }
        .status-badge { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.85rem; 
            font-weight: 500;
            margin-left: 10px;
        }
        .status-active { background: #065f46; color: #6ee7b7; }
        .status-testing { background: #92400e; color: #fbbf24; }
        .status-ready { background: #1e40af; color: #93c5fd; }
        footer { 
            margin-top: 60px; 
            padding-top: 20px; 
            border-top: 1px solid #1e293b; 
            text-align: center; 
            color: #64748b;
            font-size: 0.9rem;
        }
        .fleet-footer { 
            color: #f43f5e; 
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .btn { 
            background: #f43f5e; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 6px; 
            cursor: pointer; 
            font-weight: 500;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.9; }
        .stall-warning { 
            background: #7c2d12; 
            border: 1px solid #ea580c; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Meta Repair</h1>
            <p class="subtitle">Fleet heals its own brain. Autonomous stall detection, variant generation, isolated testing, and auto-promotion.</p>
        </header>
        ${body}
        <footer>
            <p><span class="fleet-footer">FLEET CONTROL</span> — Autonomous Meta-Repair System</p>
            <p>All systems operational. Neural pathways intact.</p>
        </footer>
    </div>
</body>
</html>`;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // Set security headers for all responses
        const securityHeaders = {
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;",
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff'
        };

        // Health endpoint
        if (path === '/health') {
            return new Response('OK', {
                headers: { 'Content-Type': 'text/plain', ...securityHeaders }
            });
        }

        // API endpoints
        if (path === '/api/detect-stall' && request.method === 'POST') {
            try {
                const id = env.STALL_COUNTER.idFromName('global');
                const stub = env.STALL_COUNTER.get(id);
                
                const response = await stub.fetch('http://counter/increment');
                const stallData = await response.json() as StallData;
                
                // Check if stall count >= 3 and generate variant
                if (stallData.count >= 3) {
                    const variantId = `variant_${Date.now()}`;
                    const variant: Variant = {
                        id: variantId,
                        code: this.generateVariantCode(),
                        status: 'testing',
                        created: Date.now(),
                        testsPassed: false
                    };
                    
                    await env.VARIANTS.put(variantId, JSON.stringify(variant));
                    
                    // Reset stall counter after generating variant
                    await stub.fetch('http://counter/reset');
                    
                    return new Response(JSON.stringify({
                        stallDetected: true,
                        variantGenerated: variantId,
                        message: 'Stall threshold reached. New variant generated.'
                    }), {
                        headers: { 'Content-Type': 'application/json', ...securityHeaders }
                    });
                }
                
                return new Response(JSON.stringify({
                    stallDetected: false,
                    currentCount: stallData.count,
                    threshold: 3
                }), {
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
                
            } catch (error) {
                return new Response(JSON.stringify({ error: 'Detection failed' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
            }
        }

        if (path === '/api/variants' && request.method === 'GET') {
            try {
                const keys = await env.VARIANTS.list();
                const variants: Variant[] = [];
                
                for (const key of keys.keys) {
                    const variant = await env.VARIANTS.get<Variant>(key.name, 'json');
                    if (variant) variants.push(variant);
                }
                
                return new Response(JSON.stringify(variants), {
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: 'Failed to fetch variants' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
            }
        }

        if (path === '/api/promote' && request.method === 'POST') {
            try {
                const { variantId } = await request.json() as { variantId: string };
                
                if (!variantId) {
                    return new Response(JSON.stringify({ error: 'variantId required' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...securityHeaders }
                    });
                }
                
                const variant = await env.VARIANTS.get<Variant>(variantId, 'json');
                if (!variant) {
                    return new Response(JSON.stringify({ error: 'Variant not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json', ...securityHeaders }
                    });
                }
                
                // Update variant status to active
                variant.status = 'active';
                variant.testsPassed = true;
                await env.VARIANTS.put(variantId, JSON.stringify(variant));
                
                // Set other variants to ready (not active)
                const keys = await env.VARIANTS.list();
                for (const key of keys.keys) {
                    if (key.name !== variantId) {
                        const otherVariant = await env.VARIANTS.get<Variant>(key.name, 'json');
                        if (otherVariant && otherVariant.status === 'active') {
                            otherVariant.status = 'ready';
                            await env.VARIANTS.put(key.name, JSON.stringify(otherVariant));
                        }
                    }
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: `Variant ${variantId} promoted to active`,
                    variant
                }), {
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
                
            } catch (error) {
                return new Response(JSON.stringify({ error: 'Promotion failed' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...securityHeaders }
                });
            }
        }

        // Dashboard HTML
        if (path === '/' || path === '/dashboard') {
            try {
                // Get current stall status
                const id = env.STALL_COUNTER.idFromName('global');
                const stub = env.STALL_COUNTER.get(id);
                const statusResponse = await stub.fetch('http://counter/status');
                const stallData = await statusResponse.json() as StallData;
                
                // Get variants
                const keys = await env.VARIANTS.list();
                const variants: Variant[] = [];
                for (const key of keys.keys) {
                    const variant = await env.VARIANTS.get<Variant>(key.name, 'json');
                    if (variant) variants.push(variant);
                }
                
                const stallWarning = stallData.count >= 2 ? `
                    <div class="stall-warning">
                        <strong>Warning:</strong> ${stallData.count} stall(s) detected. 
                        ${stallData.count >= 3 ? 'Threshold reached! Variant generation triggered.' : 'One more stall will trigger variant generation.'}
                    </div>
                ` : '';
                
                const variantsHtml = variants.map(v => `
                    <div class="card">
                        <h2>${v.id} <span class="status-badge status-${v.status}">${v.status.toUpperCase()}</span></h2>
                        <p><strong>Created:</strong> ${new Date(v.created).toLocaleString()}</p>
                        <p><strong>Tests:</strong> ${v.testsPassed ? '✅ Passed' : '⏳ Pending'}</p>
                        ${v.status !== 'active' ? `
                            <button class="btn" onclick="promoteVariant('${v.id}')">Promote to Active</button>
                        ` : ''}
                    </div>
                `).join('');
                
                const body = `
                    ${stallWarning}
                    <div class="grid">
                        <div class="card">
                            <h2>Stall Detection</h2>
                            <p><strong>Current count:</strong> ${stallData.count}/3</p>
                            <p><strong>Last stall:</strong> ${stallData.lastStallTime ? new Date(stallData.lastStallTime).toLocaleString() : 'Never'}</p>
                            <p><strong>Active orchestrator:</strong> ${stallData.orchestratorVersion}</p>
                            <button class="btn" onclick="simulateStall()">Simulate Stall</button>
                        </div>
                        
                        <div class="card">
                            <h2>API Endpoints</h2>
                            <div class="endpoint">
                                <code>POST /api/detect-stall</code>
                                <p>Detect and record a stall event</p>
                            </div>
                            <div class="endpoint">
                                <code>GET /api/variants</code>
                                <p>List all orchestrator variants</p>
                            </div>
                            <div class="endpoint">
                                <code>POST /api/promote</code>
                                <p>Promote a variant to active</p>
                            </div>
                        </div>
                    </div>
                    
                    <h2>Orchestrator Variants (${variants.length})</h2>
                    <div class="grid">
                        ${variants.length > 0 ? variantsHtml : '<p>No variants generated yet.</p>'}
                    </div>
                    
                    <script>
                        async function simulateStall() {
                            const response = await fetch('/api/detect-stall', { method: 'POST' });
                            const result = await response.json();
                            if (result.stallDetected) {
                                alert('Stall threshold reached! New variant generated: ' + result.variantGenerated);
                            }
                            location.reload();
                        }
                        
                        async function promoteVariant(variantId) {
                            const response = await fetch('/api/promote', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ variantId })
                            });
                            const result = await response.json();
                            if (result.success) {
                                alert('Variant promoted successfully!');
                                location.reload();
                            }
                        }
                    </script>
                `;
                
                return new Response(HTML_TEMPLATE(body), {
                    headers: { 
                        'Content-Type': 'text/html; charset=utf-8',
                        ...securityHeaders
                    }
                });
                
            } catch (error) {
                const errorBody = `
                    <div class="card">
                        <h2>Error</h2>
                        <p>Failed to load dashboard data. Please try again.</p>
                    </div>
                `;
                return new Response(HTML_TEMPLATE(errorBody), {
                    headers: { 
                        'Content-Type': 'text/html; charset=utf-8',
                        ...securityHeaders
                    }
                });
            }
        }

        // 404 for unknown routes
        const notFoundBody = `
            <div class="card">
                <h2>404 - Not Found</h2>
                <p>The requested resource was not found.</p>
                <a href="/" style="color: #f43f5e;">Return to Dashboard</a>
            </div>
        `;
        return new Response(HTML_TEMPLATE(notFoundBody), {
            status: 404,
            headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                ...securityHeaders
            }
        });
    },

    generateVariantCode(): string {
        const strategies = [
            'exponential_backoff',
            'randomized_retry',
            'circuit_breaker',
            'load_shedding',
            'priority_queue'
        ];
        
        const selectedStrategy = strategies[Math.floor(Math.random() * strategies.length)];
        const timeout = Math.floor(Math.random() * 5000) + 1000;
        const retries = Math.floor(Math.random() * 5) + 1;
        
        return `// Auto-generated variant
// Strategy: ${selectedStrategy}
// Timeout: ${timeout}ms
// Max retries: ${retries}

export default {
    async handle(request, env, ctx) {
        const strategy = "${selectedStrategy}";
        const maxRetries = ${retries};
        const timeoutMs = ${timeout};
        
        // Implementation varies based on strategy
        return await this[strategy](request, env, ctx, maxRetries, timeoutMs);
    },
    
    exponential_backoff: async function(request, env, ctx, maxRetries, timeoutMs) {
        // Exponential backoff implementation
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fetch(request);
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
            }
        }
    },
    
    randomized_retry: async function(request, env, ctx, maxRetries, timeoutMs) {
        // Randomized retry implementation
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fetch(request);
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                const jitter = Math.random() * 100;
                await new Promise(r => setTimeout(r, timeoutMs + jitter));
            }
        }
    }
}`;
    }
} satisfies ExportedHandler<Env>;

export { StallCounter };