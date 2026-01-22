(function () {
    const path = window.location.pathname;
    const isLandingPage = path.endsWith('landing.html') || path === '/' || path === '';

    if (sessionStorage.getItem('dashboard_auth') !== 'true' && !isLandingPage) {
        window.location.href = '/landing.html';
    }
})();
