import { AppProvider, useApp } from "./context/AppContext";
import AlbumsPage from "./pages/Albums";
import DownloadPage from "./pages/Download";
import LoginPage from "./pages/Login";
import SettingsPage from "./pages/Settings";

function Router() {
	const { page } = useApp();

	switch (page) {
		case "login":
			return <LoginPage />;
		case "albums":
			return <AlbumsPage />;
		case "download":
			return <DownloadPage />;
		case "settings":
			return <SettingsPage />;
		default:
			return <LoginPage />;
	}
}

export default function App() {
	return (
		<AppProvider>
			<Router />
		</AppProvider>
	);
}
