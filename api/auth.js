
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD;

    if (!correctPassword) {
        return res.status(500).json({ error: 'Senha do dashboard não configurada no servidor.' });
    }

    if (password === correctPassword) {
        // Retornamos um sucesso. Em um sistema real usaríamos um JWT, 
        // mas para este dashboard, um sucesso na validação é o suficiente para o front-end.
        res.status(200).json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false, error: 'Senha incorreta.' });
    }
}
