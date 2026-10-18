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
import LoginPage from './LoginPage.tsx';
import { clearStoredSession, getStoredSession, storeSession, type AuthUser, type StoredSession } from './auth';

function App() {
	const { t } = useTranslation();
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const [selectedDetails, setSelectedDetails] = useState<LocationSidebarItem | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [session, setSession] = useState<StoredSession | null>(getStoredSession);
	const authToken = session?.token ?? null;
	const authUser = session?.user ?? null;
	const [servicesOpen, setServicesOpen] = useState(false);

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

	const header = <Header authToken={authToken} isAdmin={authUser?.isAdmin ?? false} onLogout={handleLogout} />;

	return (
		<>
			<Routes>
				<Route
					path="/"
					element={
						<div className="map-page">
							<Header authToken={authToken} isAdmin={authUser?.isAdmin ?? false} onLogout={handleLogout}>
								<div className="header-search-row">
									<SearchBar
										query={searchQuery}
										onQueryChange={setSearchQuery}
										selectedCategory={categoryFilter}
										onCategoryChange={setCategoryFilter}
									/>
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
									onMarkerSelect={handleLocationSelect}
								/>
							</div>

							{!selectedDetails && !servicesOpen && <EventsCard />}

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
									<CardDeck title={t('map.servicesTitle')} onLocationSelect={handleLocationSelect} categoryFilter={categoryFilter} searchQuery={searchQuery} />
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
								? <CreateLocationPage authToken={authToken} onAuthError={handleLogout} />
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
								? <ManageLocationsPage key={authUser.id} authToken={authToken} user={authUser} onAuthError={handleLogout} />
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
