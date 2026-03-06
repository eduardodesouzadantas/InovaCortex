import { buildSegments, enforceKAnonymity, OrgData } from '@/lib/market-intel/benchmark-engine';

describe('Market Intelligence: Benchmark Engine', () => {

    describe('buildSegments', () => {
        it('groups orgs into distinct dimension buckets', () => {
            const orgs: OrgData[] = [
                { id: '1', industry: 'clinics', sizeBand: 'small', plan: 'growth' },
                { id: '2', industry: 'clinics', sizeBand: 'small', plan: 'growth' },
                { id: '3', industry: 'agencies', sizeBand: 'enterprise', plan: 'enterprise' }
            ];

            const segments = buildSegments(orgs, '30d');
            expect(segments).toHaveLength(2);

            const clinics = segments.find(s => s.industry === 'clinics');
            expect(clinics?.orgs).toEqual(['1', '2']);

            const agencies = segments.find(s => s.industry === 'agencies');
            expect(agencies?.orgs).toEqual(['3']);
        });
    });

    describe('enforceKAnonymity', () => {
        const threshold = 8;

        it('retains buckets that natively hit the K threshold', () => {
            const orgs = Array.from({ length: 10 }, (_, i) => ({
                id: `id_${i}`, industry: 'consulting', sizeBand: 'medium', plan: 'growth'
            }));
            const segments = buildSegments(orgs, '30d');
            const valid = enforceKAnonymity(segments, threshold);

            expect(valid).toHaveLength(2); // Local strict + Global fallback

            const strict = valid.find(s => s.plan === 'growth');
            expect(strict).toBeDefined();
            expect(strict?.orgs.length).toBe(10);
        });

        it('collapses the Plan dimension if a bucket is too small, retaining K-Anonymity', () => {
            const orgs: OrgData[] = [];
            // 5 orgs on free, 5 orgs on enterprise -> same industry and size
            for (let i = 0; i < 5; i++) orgs.push({ id: `f_${i}`, industry: 'clinics', sizeBand: 'small', plan: 'free' });
            for (let i = 0; i < 5; i++) orgs.push({ id: `e_${i}`, industry: 'clinics', sizeBand: 'small', plan: 'enterprise' });

            const segments = buildSegments(orgs, '30d');
            expect(segments).toHaveLength(2);

            const valid = enforceKAnonymity(segments, threshold);
            // Both strict buckets (5 each) fail K=8.
            // They collapse into "clinics-small-all" containing 10 orgs.

            const collapsedPlan = valid.find(s => s.plan === 'all' && s.sizeBand === 'small');
            expect(collapsedPlan).toBeDefined();
            expect(collapsedPlan?.orgs.length).toBe(10);
        });

        it('discards buckets entirely if collapsing all dimensions still fails K-Anonymity', () => {
            const orgs: OrgData[] = [
                { id: '1', industry: 'niche_market', sizeBand: 'small', plan: 'free' },
                { id: '2', industry: 'niche_market', sizeBand: 'small', plan: 'free' }
            ];

            const segments = buildSegments(orgs, '30d');
            const valid = enforceKAnonymity(segments, threshold);

            // Should be totally empty because 2 is always less than 8 regardless of dimension collapse.
            expect(valid).toHaveLength(0);
        });
    });
});
