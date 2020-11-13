export default interface CloudService {
  poll(): void;
  ack(): void;
}