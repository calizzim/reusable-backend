module.exports = {
  template: {
    title: "Login",
    showTitle: true,
    resetOnSubmit: false,
    groups: [
      {
        title: "userInfo",
        showTitle: false,
        components: [
          {
            dType: String,
            type: "text",
            name: "email",
            validators: "email",
          },
          {
            dType: String,
            type: "text",
            name: "password",
            validators: "password",
            hidden: true,
          },
        ],
      },
    ],
  },
};
