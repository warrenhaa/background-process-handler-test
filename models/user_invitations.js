module.exports = (sequelize, DataTypes) => {
  const userInvitations = sequelize.define('user_invitations', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: DataTypes.STRING,
    created_by: DataTypes.STRING,
    updated_by: DataTypes.STRING,
    status: DataTypes.STRING,
    expires_at: DataTypes.DATE,
    initial_permissions: DataTypes.JSONB,
    company_id: DataTypes.UUID,
  }, {});
  userInvitations.associate = (models) => {
    // associations can be defined here
    userInvitations.hasOne(models.users, { foreignKey: 'invite_id', targetKey: 'id' });
    userInvitations.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return userInvitations;
};
