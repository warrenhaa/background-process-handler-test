module.exports = (sequelize, DataTypes) => {
  const occupantInvitation = sequelize.define('occupants_invitations', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    invite_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invited_at: {
      allowNull: true,
      type: DataTypes.DATE,
    },
    invited_by: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    expires_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {
    freezeTableName: true,
    tableName: 'occupants_invitations',
  });
  occupantInvitation.associate = (models) => {
    occupantInvitation.hasOne(models.occupants, { foreignKey: 'invite_id' });
    occupantInvitation.hasOne(models.occupants_locations, { foreignKey: 'occupant_invite_id' });
  };
  return occupantInvitation;
};
