export class AppError extends Error {
	public statusCode: number;
	public status: number;

	constructor(statusCode: number, message: string, stack = "") {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.status = statusCode;
		Object.setPrototypeOf(this, new.target.prototype);

		if (stack) {
			this.stack = stack;
		} else {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}