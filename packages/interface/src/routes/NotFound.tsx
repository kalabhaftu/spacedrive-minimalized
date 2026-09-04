import { useNavigate, useLocation } from "react-router-dom";
import { House, Compass, ArrowLeft, Question } from "@phosphor-icons/react";
import AppLogo from "@sd/assets/images/AppLogo.png";

export function NotFound() {
	const navigate = useNavigate();
	const location = useLocation();

	return (
		<div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-app select-none">
			<div className="relative mb-6 flex items-center justify-center">
				<div className="absolute size-28 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
				<div className="relative flex size-20 items-center justify-center rounded-2xl border border-app-line bg-app-box shadow-xl">
					<img src={AppLogo} alt="Spacedrive" className="size-10 opacity-80" />
					<div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-accent text-white shadow-md">
						<Question size={14} weight="bold" />
					</div>
				</div>
			</div>

			<div className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-box/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-3">
				404 • Not Found
			</div>

			<h1 className="text-2xl font-bold text-ink mb-2">Page Not Found</h1>
			<p className="max-w-md text-sm text-ink-dull mb-6 leading-relaxed">
				The path <code className="rounded bg-app-box px-1.5 py-0.5 font-mono text-xs text-ink">{location.pathname}</code> does not exist or may have been moved.
			</p>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="flex items-center gap-2 rounded-lg border border-app-line bg-app-box px-4 py-2 text-sm font-medium text-ink hover:bg-app-hover hover:border-app-line/80 transition-colors cursor-pointer"
				>
					<ArrowLeft size={16} weight="bold" />
					<span>Go Back</span>
				</button>

				<button
					type="button"
					onClick={() => navigate("/explorer?home=true")}
					className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-deep transition-colors shadow-sm cursor-pointer"
				>
					<House size={16} weight="bold" />
					<span>Open Home</span>
				</button>

				<button
					type="button"
					onClick={() => navigate("/")}
					className="flex items-center gap-2 rounded-lg border border-app-line bg-app-box px-4 py-2 text-sm font-medium text-ink hover:bg-app-hover hover:border-app-line/80 transition-colors cursor-pointer"
				>
					<Compass size={16} weight="bold" />
					<span>Overview</span>
				</button>
			</div>
		</div>
	);
}
