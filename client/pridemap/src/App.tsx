import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom'
import MapComponent from './MapComponent';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import LocationSidebar, { type LocationSidebarItem } from './components/LocationSidebar';
import './App.css'
import CardDeck from './CardDeck';
import EventsCard from './components/EventsCard';
import CreateLocationPage from './CreateLocationPage.tsx';
import ManageLocationsPage from './ManageLocationsPage.tsx';
import ManageRegionsPage from './ManageRegionsPage.tsx';
import LoginPage from './LoginPage.tsx';
import { clearStoredSession, getStoredSession, storeSession, type AuthUser, type StoredSession } from './auth';
import { getStoredRegionId, storeActiveRegionId, type Region } from './regions';
import RegionSelector from './components/RegionSelector';

function App() {
	const { t } = useTranslation();
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const [selectedDetails, setSelectedDetails] = useState<LocationSidebarItem | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [session, setSession] = useState<StoredSession | null>(getStoredSession);
	const [regions, setRegions] = useState<Region[]>([]);
	const [activeRegionId, setActiveRegionId] = useState<number | null>(getStoredRegionId);
	const authToken = session?.token ?? null;
	const authUser = session?.user ?? null;
	const [servicesOpen, setServicesOpen] = useState(false);
	const activeRegion = regions.find(region => region.id === activeRegionId);
	const canManageRegions = Boolean(authUser?.isAdmin || authUser?.regionAdminIds?.length);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/regions')
			.then(async response => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json() as Promise<Region[]>;
			})
			.then(list => {
				if (cancelled) return;
				setRegions(list);
				const storedId = getStoredRegionId();
				const nextRegion = list.find(region => region.id === storedId)
					?? list.find(region => region.name.toLocaleLowerCase() === 'ottawa')
					?? list[0];
				if (nextRegion) {
					setActiveRegionId(nextRegion.id);
					storeActiveRegionId(nextRegion.id);
				}
			})
			.catch(error => console.error('Could not load regions:', error));
		return () => { cancelled = true; };
	}, []);

	const handleRegionChange = useCallback((regionId: number) => {
		setActiveRegionId(regionId);
		storeActiveRegionId(regionId);
		setSelectedLocation(null);
		setSelectedDetails(null);
		setServicesOpen(false);
	}, []);

	const handleLocationSelect = (lat: number, lng: number, name: string, details?: Partial<LocationSidebarItem>) => {
		setSelectedLocation({lat, lng, name});
		setSelectedDetails({
			name,
			nameFr: details?.nameFr ?? null,
			categories: details?.categories ?? [],
			description: details?.description ?? null,
			descriptionFr: details?.descriptionFr ?? null,
			address: details?.address ?? null,
			url: details?.url ?? null,
			imageUrl: details?.imageUrl ?? null,
		});
		setServicesOpen(false);
	};

	function handleLogin(token: string, user: AuthUser) {
		const next = { token, user };
		storeSession(next);
		setSession(next);
	}

	// Stable so the dashboard's data-loading effects don't re-run every render.
	const handleLogout = useCallback(() => {
		clearStoredSession();
		setSession(null);
	}, []);

	// Re-check a restored session: the account may have been deleted, had its
	// password changed, or gained/lost admin rights since the token was issued.
	useEffect(() => {
		if (!authToken) return;
		let cancelled = false;
		fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${authToken}` } })
			.then(async (res) => {
				if (cancelled) return;
				if (res.status === 401) { handleLogout(); return; }
				if (!res.ok) return;
				const json = await res.json();
				if (cancelled) return;
				const next = { token: authToken, user: json.user as AuthUser };
				storeSession(next);
				setSession(prev => (prev?.token === authToken && JSON.stringify(prev.user) === JSON.stringify(next.user) ? prev : next));
			})
			.catch((err) => console.error('Could not verify the saved session:', err));
		return () => { cancelled = true; };
	}, [authToken, handleLogout]);

	const header = <Header authToken={authToken} isAdmin={canManageRegions} canManageRegions={canManageRegions} onLogout={handleLogout} />;

	return (
		<>
			<Routes>
				<Route
					path="/"
					element={
						<div className="map-page">
							<Header authToken={authToken} isAdmin={canManageRegions} canManageRegions={canManageRegions} onLogout={handleLogout}>
								<div className="header-search-row">
									<SearchBar
										query={searchQuery}
										onQueryChange={setSearchQuery}
										selectedCategory={categoryFilter}
										onCategoryChange={setCategoryFilter}
									/>
									<RegionSelector regions={regions} selectedRegionId={activeRegionId} onChange={handleRegionChange} />
									{!selectedDetails && (
										<button
											type="button"
											className="see-all-btn"
											onClick={() => setServicesOpen(open => !open)}
											aria-expanded={servicesOpen}
										>
											{t('map.seeAll')}
										</button>
									)}
								</div>
							</Header>
							<div className="map-fullscreen">
								<MapComponent
									selectedLocation={selectedLocation}
									categoryFilter={categoryFilter}
									searchQuery={searchQuery}
									regionId={activeRegionId}
									onMarkerSelect={handleLocationSelect}
								/>
							</div>

							{!selectedDetails && !servicesOpen && activeRegion && <EventsCard regionId={activeRegion.id} regionName={activeRegion.name} />}

							<LocationSidebar location={selectedDetails} onClose={() => setSelectedDetails(null)} />

							{servicesOpen && (
								<div className="services-scrim" onClick={() => setServicesOpen(false)} aria-hidden="true" />
							)}

							<aside
								className={`services-drawer ${servicesOpen ? 'services-drawer--open' : ''}`}
								aria-label={t('map.drawerLabel')}
								aria-hidden={!servicesOpen}
							>
								<button
									type="button"
									className="services-drawer__close"
									aria-label={t('map.closeServices')}
									onClick={() => setServicesOpen(false)}
								>
									×
								</button>
								<div className="services-drawer__body">
									<CardDeck title={t('map.servicesTitle')} onLocationSelect={handleLocationSelect} categoryFilter={categoryFilter} searchQuery={searchQuery} regionId={activeRegionId} />
								</div>
							</aside>
						</div>
					}
				/>
				<Route
					path="/create-location"
					element={
						<>
							{header}
							{authToken
								? <CreateLocationPage authToken={authToken} selectedRegionId={activeRegionId} onAuthError={handleLogout} />
								: <LoginPage onLogin={handleLogin} intro={t('login.submitIntro')} />}
						</>
					}
				/>
				<Route
					path="/manage-locations"
					element={
						<>
							{header}
							{authToken && authUser
								// Keyed by account so switching users never shows stale data.
								? <ManageLocationsPage key={authUser.id} authToken={authToken} user={authUser} selectedRegionId={activeRegionId} onAuthError={handleLogout} />
								: <LoginPage onLogin={handleLogin} />}
						</>
					}
				/>
				<Route
					path="/manage-regions"
					element={
						<>
							{header}
							{authToken && authUser && canManageRegions
								? <ManageRegionsPage key={authUser.id} authToken={authToken} user={authUser} onAuthError={handleLogout} />
								: authToken
									? <Navigate to="/manage-locations" replace />
									: <LoginPage onLogin={handleLogin} />}
						</>
					}
				/>
				<Route
					path="/login"
					element={
						authToken
							? <Navigate to="/manage-locations" replace />
							: <>{header}<LoginPage onLogin={handleLogin} /></>
					}
				/>
			</Routes>
		</>
	)
}

export default App
