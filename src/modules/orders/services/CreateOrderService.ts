import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({
    customer_id,
    products: requestedProducts,
  }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Invalid customer.');
    }

    const stockProducts = await this.productsRepository.findAllById(
      requestedProducts,
    );

    const orderProducts = requestedProducts.map(requestedProduct => {
      const stockProduct = stockProducts.find(
        p => p.id === requestedProduct.id,
      );

      if (!stockProduct) {
        throw new AppError('Invalid product.');
      }

      if (stockProduct.quantity < requestedProduct.quantity) {
        throw new AppError(
          `Not enough items of "${stockProduct.name}" in stock.`,
        );
      }

      stockProduct.quantity -= requestedProduct.quantity;

      return {
        product_id: stockProduct.id,
        price: stockProduct.price,
        quantity: requestedProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(stockProducts);

    return order;
  }
}

export default CreateProductService;
