import { TeamScopeGuard } from './team-scope.guard';
const context = (body: any, path = '/knowledge/run') =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        method: 'POST',
        query: {},
        path,
        user: { uid: 'u' },
      }),
    }),
  }) as any;
describe('Team authorization', () => {
  it('rejects missing scope', async () => {
    await expect(
      new TeamScopeGuard({} as any).canActivate(context({})),
    ).rejects.toThrow();
  });
  it('rejects other teams', async () => {
    const guard = new TeamScopeGuard({
      teamMember: { findUnique: async () => null },
    } as any);
    await expect(
      guard.canActivate(context({ teamId: 'other' })),
    ).rejects.toThrow();
  });
  it('allows viewers to read but not reindex', async () => {
    const guard = new TeamScopeGuard({
      teamMember: { findUnique: async () => ({ role: 'VIEWER' }) },
    } as any);
    expect(await guard.canActivate(context({ teamId: 't' }))).toBe(true);
    await expect(
      guard.canActivate(context({ teamId: 't' }, '/api-search/sync')),
    ).rejects.toThrow();
  });
  it('rejects conflicting query and body scopes', async () => {
    const guard = new TeamScopeGuard({} as any);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          body: { teamId: 'own' },
          query: { teamId: 'other' },
          user: { uid: 'u' },
          path: '/api-search/specs',
        }),
      }),
    } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow('Conflicting');
  });
  it('protects sync routes with a trailing slash', async () => {
    const guard = new TeamScopeGuard({
      teamMember: { findUnique: async () => ({ role: 'VIEWER' }) },
    } as any);
    await expect(
      guard.canActivate(context({ teamId: 't' }, '/api-search/sync/')),
    ).rejects.toThrow('Editor');
  });
  it('takes GET scope from query parameters', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: 'VIEWER' });
    const guard = new TeamScopeGuard({ teamMember: { findUnique } } as any);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          query: { teamId: 'team-query' },
          user: { uid: 'u' },
          path: '/api-search/status',
        }),
      }),
    } as any;
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(findUnique.mock.calls[0][0].where.teamID_userUid.teamID).toBe(
      'team-query',
    );
  });
});
