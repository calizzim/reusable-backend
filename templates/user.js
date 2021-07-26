module.exports = {
  template: {
    title: 'Signup',
    showTitle: true,
    resetOnSubmit: false,
    groups: [
        {
            title: 'userInfo',
            showTitle: false,
            components: [
                {
                    dType: String,
                    type: 'text',
                    name: 'email',
                    validators: 'email',
                    asyncValidators: ['unique'],
                },
                {
                    dType: String,
                    type: 'text',
                    name: 'password',
                    validators: 'password',
                    hidden: true
                },
            ]
        }
    ]
  }
}