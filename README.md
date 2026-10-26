# BL Studio

Kit de stream complet pour OBS : overlays animés, alertes, bot, chat unifié, mini-jeux et multistream
Twitch + TikTok (vertical) + YouTube, piloté depuis un panneau intégré à OBS.

## Installer

1. Télécharge **BL-Studio-Setup.exe** depuis la [dernière version](../../releases/latest).
2. Double-clique dessus, puis **Installer**. Si Windows affiche « Windows a protégé votre ordinateur » :
   **Informations complémentaires → Exécuter quand même** (l'installeur n'est pas signé).

Sans l'exe : télécharge **install.ps1**, clic droit → **Exécuter avec PowerShell**.
Relancer l'installeur plus tard met BL Studio à jour sans toucher à tes réglages.

L'installeur ajoute ce qui manque (OBS Studio, plugins Aitum Vertical et Multistream, Node.js, Python, ffmpeg),
installe BL Studio dans `%USERPROFILE%\BLStudio`, configure OBS puis l'ouvre.

## Premiers réglages

Dans OBS, le dock **BL Studio** :

- **Identité** : logo, nom de la chaîne, réseaux, puis « Appliquer partout ».
- **DA & animations** : choisis un pack ou compose ta DA (thème, police, style des widgets, fond, transition).
- **Connexions** : Twitch (bouton « Se connecter »), pseudo TikTok, chaîne YouTube.
- **Diffusion** : colle l'URL et la clé TikTok. La clé YouTube se colle dans le dock **Aitum Multistream**.

Dans OBS → Paramètres → Stream, connecte ton compte Twitch.

## Mises à jour

BL Studio vérifie les nouvelles versions au démarrage puis toutes les 6 heures et les installe tout seul,
jamais pendant un live. Tes réglages, jetons, points et ton logo sont conservés.
Réglage dans **Connexions → Mises à jour**.

## Publier une version (mainteneur)

```
python outils/publier.py 1.1.0 "Ce qui change"
```
