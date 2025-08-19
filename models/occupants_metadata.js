module.exports = (sequelize, DataTypes) => {
  const occupantMetadata = sequelize.define('occupants_metadata', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    key: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    value: {
      type: DataTypes.TEXT,
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
    tableName: 'occupants_metadata',
  });
  occupantMetadata.associate = (models) => {
    occupantMetadata.belongsTo(models.occupants, { foreignKey: 'occupant_id', targetKey: 'id' });
  };
  return occupantMetadata;
};
