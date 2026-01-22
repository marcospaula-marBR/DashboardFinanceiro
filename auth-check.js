
(function () {
    // Verifica se o usuário está na página de landing (que tem o login)
    const isLandingPage = window.location.pathname.includes('landing.html') || window.location.pathname === '/';

    // Se não estiver autenticado e não estiver na landing page, redireciona
    if (sessionStorage.getItem('dashboard_auth') !== 'true' && !isLandingPage) {
        window.location.href = 'landing.html';
    }
})();
