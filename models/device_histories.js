module.exports = (sequelize, DataTypes) => {
  const DevicesHistories = sequelize.define('device_histories', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    device_code: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    model: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    property_name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    value: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    parsed_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    event_at: {
      allowNull: false,
      type: DataTypes.DATE,
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
    tableName: 'device_histories',
  });
  DevicesHistories.associate = (models) => {
    DevicesHistories.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return DevicesHistories;
};
