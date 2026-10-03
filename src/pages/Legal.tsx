import { Link } from "react-router-dom";
import "../styles/legal.css";

const Legal = () => {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <h1 className="legal-page__title">Mentions légales</h1>
        <p className="legal-page__subtitle">
          Informations légales relatives au site Lucy Portal, conformément au
          droit français (notamment la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l’économie numérique — LCEN).
        </p>
      </header>

      <section className="legal-section" aria-labelledby="legal-editor">
        <h2 id="legal-editor">1. Éditeur du site</h2>
        <div className="legal-card">
          <dl className="legal-dl">
            <div>
              <dt>Nom / raison sociale</dt>
              <dd>Lucy Robotics</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a href="mailto:contact@lucy-robotics.com">contact@lucy-robotics.com</a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="legal-rgpd">
        <h2 id="legal-rgpd">2. Données personnelles (RGPD)</h2>
        <div className="legal-card">
          <p>
            Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi
            « Informatique et Libertés », le présent site{" "}
            <strong>ne collecte pas de données personnelles</strong> auprès des
            visiteurs.
          </p>
          <ul>
            <li>
              <strong>Pas de cookies</strong> déposés à des fins de mesure
              d’audience, de publicité ou de tracking.
            </li>
            <li>
              <strong>Aucun formulaire</strong> de contact, d’inscription ou de
              newsletter n’enregistre de données visiteurs sur ce site.
            </li>
            <li>
              Une seule entrée en <strong>local storage</strong> du navigateur
              peut être créée pour la session d’un{" "}
              <strong>administrateur authentifié</strong> (jeton / état de
              connexion OIDC). Elle n’est pas utilisée pour le suivi des
              visiteurs anonymes.
            </li>
          </ul>
          <p>
            Pour toute question relative à la protection des données :{" "}
            <a href="mailto:contact@example.com">contact@example.com</a>. Vous
            pouvez également saisir la CNIL (
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.cnil.fr
            </a>
            ).
          </p>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="legal-a11y">
        <h2 id="legal-a11y">3. Accessibilité</h2>
        <div className="legal-card">
          <p>
            Un rapport décrivant l’accessibilité de chaque page du site est
            disponible à l’adresse suivante :{" "}
            <Link to="/accessibility">/accessibility</Link>.
          </p>
          <p>
            Ce rapport présente les mesures déjà mises en œuvre et les axes
            d’amélioration restants. Il ne constitue pas une attestation de
            conformité RGAA / WCAG.
          </p>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="legal-ip">
        <h2 id="legal-ip">4. Propriété intellectuelle</h2>
        <div className="legal-card">
          <p>
            Les contenus originaux du site (textes, éléments graphiques propres
            au projet Lucy / Lucy Robotics), sauf mention contraire,
            restent la propriété de leurs auteurs respectifs. Toute
            reproduction non autorisée peut constituer une contrefaçon.
          </p>
          <ul>
            <li>
              Code du projet Lucy : licence <strong>GPLv3</strong> (voir le
              dépôt GitHub du projet).
            </li>
            <li>
              Modèles 3D InMoov : licence{" "}
              <strong>CC BY-NC 4.0</strong> (Gael Langevin), conformément aux
              conditions d’InMoov.
            </li>
          </ul>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="legal-liability">
        <h2 id="legal-liability">5. Limitation de responsabilité</h2>
        <div className="legal-card">
          <p>
            L’éditeur s’efforce d’assurer l’exactitude des informations
            publiées et la disponibilité du site, sans pouvoir garantir
            l’absence d’erreurs, d’interruptions ou d’omissions. L’utilisation
            du site et des logiciels associés se fait sous la responsabilité de
            l’utilisateur.
          </p>
          <p>
            Les liens vers des sites tiers (documentation, GitHub, réseaux
            sociaux, etc.) n’engagent pas l’éditeur quant au contenu de ces
            sites.
          </p>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="legal-law">
        <h2 id="legal-law">6. Droit applicable</h2>
        <div className="legal-card">
          <p>
            Les présentes mentions sont régies par le{" "}
            <strong>droit français</strong>. En cas de litige, et à défaut
            d’accord amiable, les tribunaux français compétents seront seuls
            saisis.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Legal;
