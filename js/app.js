const API_URL = 'https://security-scanner-backend.vercel.app';

// Initialize Clerk
window.addEventListener('load', async function () {
    const clerk = window.Clerk;
    await clerk.load();

    if (clerk.user) {
        updateUIForLoggedInUser(clerk.user);
        fetchScansHistory();
    } else {
        updateUIForLoggedOutUser();
    }

    // Auth Buttons
    document.getElementById('login-btn')?.addEventListener('click', () => clerk.openSignIn());
    document.getElementById('register-btn')?.addEventListener('click', () => clerk.openSignUp());
    document.getElementById('hero-cta')?.addEventListener('click', () => {
        if (clerk.user) {
            scrollToDashboard();
        } else {
            clerk.openSignUp();
        }
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => clerk.signOut());

    // Scan Actions
    document.getElementById('run-scan-btn')?.addEventListener('click', runNewScan);
    document.getElementById('close-results')?.addEventListener('click', () => {
        document.getElementById('results-view').style.display = 'none';
    });
});

function updateUIForLoggedInUser(user) {
    document.getElementById('hero-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('logged-out-nav').style.display = 'none';
    document.getElementById('logged-in-nav').style.display = 'block';
    document.getElementById('user-info').textContent = `Hi, ${user.firstName || user.username || 'User'}`;
}

function updateUIForLoggedOutUser() {
    document.getElementById('hero-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('logged-out-nav').style.display = 'block';
    document.getElementById('logged-in-nav').style.display = 'none';
}

async function fetchScansHistory() {
    try {
        const token = await window.Clerk.session.getToken();
        const response = await fetch(`${API_URL}/api/v1/scans/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        renderHistory(data);
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function renderHistory(scans) {
    const container = document.getElementById('scans-history');
    if (!scans || scans.length === 0) {
        container.innerHTML = '<p class="empty-state">No scans found. Start by running your first analysis!</p>';
        return;
    }

    container.innerHTML = scans.map(scan => `
        <div class="scan-item">
            <div>
                <strong>${scan.manifestType}</strong><br>
                <small>${new Date(scan.createdAt).toLocaleString()}</small>
            </div>
            <div>
                <span class="badge badge-${scan.status.toLowerCase()}">${scan.status}</span>
                <span class="risk-score ${getScoreClass(scan.riskScore)}">
                    ${scan.riskScore !== null ? scan.riskScore : '--'}
                </span>
                <button class="btn btn-outline btn-sm" onclick="viewDetails('${scan.id}')">View</button>
            </div>
        </div>
    `).join('');
}

function getScoreClass(score) {
    if (score === null) return '';
    if (score >= 7) return 'score-high';
    if (score >= 4) return 'score-medium';
    return 'score-low';
}

async function runNewScan() {
    const type = document.getElementById('manifest-type').value;
    const content = document.getElementById('manifest-content').value;

    if (!content.trim()) {
        alert('Please paste some content to scan.');
        return;
    }

    const btn = document.getElementById('run-scan-btn');
    btn.disabled = true;
    btn.textContent = 'Scanning...';

    try {
        const token = await window.Clerk.session.getToken();
        const response = await fetch(`${API_URL}/api/v1/scans/manifest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, content })
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('manifest-content').value = '';
            fetchScansHistory();
            alert('Scan job submitted successfully!');
        } else {
            alert('Error submitting scan. Please check your token or content.');
        }
    } catch (error) {
        console.error('Scan error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Run Analysis';
    }
}

async function viewDetails(id) {
    const resultsView = document.getElementById('results-view');
    const content = document.getElementById('results-content');
    
    resultsView.style.display = 'block';
    content.innerHTML = '<p>Loading details...</p>';

    try {
        const token = await window.Clerk.session.getToken();
        const response = await fetch(`${API_URL}/api/v1/scans/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        renderResults(data);
    } catch (error) {
        content.innerHTML = '<p>Error loading results.</p>';
    }
}

function renderResults(scan) {
    const content = document.getElementById('results-content');
    
    if (scan.status !== 'COMPLETED') {
        content.innerHTML = `
            <div class="status-msg">
                <h3>Status: ${scan.status}</h3>
                <p>This scan is still being processed or has failed. Please refresh in a moment.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="results-summary">
            <h3>Overall Risk Score: <span class="risk-score ${getScoreClass(scan.riskScore)}">${scan.riskScore}</span></h3>
            <p>Analyzed at: ${new Date(scan.createdAt).toLocaleString()}</p>
        </div>
        <hr style="margin: 1rem 0; border: 0; border-top: 1px solid var(--border);">
        <h3>Detected Issues by Library:</h3>
    `;

    scan.results.forEach(res => {
        html += `
            <div class="library-result">
                <h4>${res.libraryName} @ ${res.libraryVersion}</h4>
                ${res.vulnerabilities.map(v => `
                    <div class="vuln-item">
                        <strong>${v.externalId} - ${v.title || 'No title'}</strong>
                        <p>${v.description || 'No description available.'}</p>
                        <span class="badge">${v.severity || 'UNKNOWN'}</span>
                    </div>
                `).join('')}
                ${res.vulnerabilities.length === 0 ? '<p style="color: var(--success)">✓ No vulnerabilities detected</p>' : ''}
            </div>
        `;
    });

    content.innerHTML = html;
}

function scrollToDashboard() {
    document.getElementById('dashboard-section').scrollIntoView({ behavior: 'smooth' });
}
