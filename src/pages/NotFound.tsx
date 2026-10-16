import { Link } from "react-router-dom";

import "../styles/not-found.css";

const NotFound = () => {
    return (
        <div className="not-found">
            <div className="not-found__content">
                <p className="not-found__code" aria-hidden="true">
                    404
                </p>

                <h1 className="page-title not-found__title">
                    <span className="page-title__accent" aria-hidden="true">&gt;</span> Page not found
                </h1>

                <p className="not-found__subtext">
                    The page you are looking for does not exist or may have
                    been moved.
                </p>

                <div className="not-found__actions">
                    <Link
                        to="/"
                        className="header__button header__button--main not-found__button"
                    >
                        Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
