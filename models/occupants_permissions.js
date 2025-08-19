module.exports = (sequelize, DataTypes) => {
  const occupantPermissions = sequelize.define('occupants_permissions', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    gateway_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',

    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',

    },
    receiver_occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',

    },
    invitation_email: {
      type: DataTypes.STRING,
      allowNull: false,

    },
    sharer_occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',

    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',

    },
    start_time: {
      allowNull: true,
      type: DataTypes.DATE,
    },
    end_time: {
      allowNull: true,
      type: DataTypes.DATE,
    },
    is_temp_access: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    access_level: {
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
  },
  {
    freezeTableName: true,
    tableName: 'occupants_permissions',
  });
  occupantPermissions.associate = (models) => {
    occupantPermissions.belongsTo(models.devices, { as: 'gateway', foreignKey: 'gateway_id', targetKey: 'id' });
    occupantPermissions.belongsTo(models.occupants, { as: 'receiver_occupant', foreignKey: 'receiver_occupant_id', targetKey: 'id' });
    occupantPermissions.belongsTo(models.occupants, { as: 'sharer_occupant', foreignKey: 'sharer_occupant_id', targetKey: 'id' });
    occupantPermissions.belongsTo(models.users, { foreignKey: 'user_id', targetKey: 'id' });
  };
  return occupantPermissions;
};
