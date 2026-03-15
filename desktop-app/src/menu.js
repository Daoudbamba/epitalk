function buildMenuTemplate() {
  return [
    {
      label: "EpiTalk",
      submenu: [
        {
          role: "quit",
          label: "Quitter EpiTalk",
        },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        {
          role: "reload",
          label: "Recharger",
        },
        {
          role: "toggleDevTools",
          label: "Basculer les outils de développement",
        },
      ],
    },
  ];
}

module.exports = {
  buildMenuTemplate,
};
