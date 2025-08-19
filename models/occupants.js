module.exports = (sequelize, DataTypes) => {
  const occupants = sequelize.define('occupants', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    invite_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants_invitations',
        key: 'id',
      },
    },
    email: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    cognito_id: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    identity_id: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    status: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    first_name: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    phone_number: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    last_name: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    country: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    language: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    is_installer: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
  }, {
    freezeTableName: true,
    tableName: 'occupants',
  });
  occupants.associate = (models) => {
    occupants.belongsTo(models.companies, { foreignKey: 'company_id' });
    occupants.hasMany(models.occupants_locations, { foreignKey: 'occupant_id' });
    occupants.hasMany(models.one_touch_cb_communication_configs, { foreignKey: 'occupant_id' });
    occupants.hasMany(models.activity_logs, { foreignKey: 'occupant_id' });
    occupants.belongsTo(models.occupants_invitations, { foreignKey: 'invite_id' });
    occupants.hasMany(models.occupants_metadata, { foreignKey: 'occupant_id' });
  };

  return occupants;
};
