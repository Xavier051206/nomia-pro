-- Creamos la tabla Persona primero (porque Empleado depende de ella)
CREATE TABLE Persona (
    personalID SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL, -- Esto evita cédulas repetidas
    fechaNacimiento DATE
);

-- Creamos la tabla Empleado
CREATE TABLE Empleado (
    empleadoID SERIAL PRIMARY KEY,
    personaID INT REFERENCES Persona(personalID),
    puesto VARCHAR(100) NOT NULL,
    salarioBase DECIMAL(10, 2) NOT NULL,
    fechaContratacion DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo' -- Puede ser Activo, Inactivo, Vetado, Sancionado
);