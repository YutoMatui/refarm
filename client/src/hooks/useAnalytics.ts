import { useEffect, useState } from 'react';

export function useAnalytics() {
    const [visitorId, setVisitorId] = useState<string>('');

    useEffect(() => {
        let id = localStorage.getItem('visitor_id');
        if (!id) {
            // Simple random ID generator since we might not have uuid package
            id = 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('visitor_id', id);
        }
        setVisitorId(id);
    }, []);

    return { visitorId };
}
