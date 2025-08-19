module.exports = (sequelize, DataTypes) => {
    const schedules = sequelize.define('schedules', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        schedule: {
            allowNull: false,
            type: DataTypes.JSONB,
        },
        device_id: {
            allowNull: false,
            type: DataTypes.UUID,
        },
        company_id: {
            allowNull: false,
            type: DataTypes.UUID,
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
            tableName: 'schedules',
        });
    schedules.associate = (models) => {
        schedules.belongsTo(models.companies, { foreignKey: 'company_id' });
        schedules.belongsTo(models.devices, { foreignKey: 'device_id' });
    };
    return schedules;
};
